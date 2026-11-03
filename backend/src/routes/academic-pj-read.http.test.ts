import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import prisma from "../config/database";
import academicRoutes from "./academic.routes";

const offeringId = "cmoseuhxj0001ofz5r10a18l1";
const termId = "cmoseuhxj0002ofz5r10a18l2";
const classId = "cmoseuhxj0003ofz5r10a18l3";

function replace(target: object, key: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, value });
  return () => descriptor ? Object.defineProperty(target, key, descriptor) : Reflect.deleteProperty(target, key);
}

test("scoped PJ read endpoints expose only leader class data and retain coordinator access", async () => {
  const offering = {
    id: offeringId,
    termId,
    classId,
    isActive: true,
    term: { isActive: true },
    academicClass: { isActive: true },
  };
  const memberships = [{ id: "membership-1", user: { id: "student-1", name: "Student One" } }];
  const pjs = [{ id: "pj-1", membershipId: "membership-1", membership: { user: { id: "student-1", name: "Student One" } } }];
  const restores = [
    replace(prisma.user, "findUnique", async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      role: where.id === "coordinator" ? "KOORDINATOR_LAB" : where.id === "dosen" ? "DOSEN" : "MAHASISWA",
      isActive: true,
      mustChangePassword: false,
    })),
    replace(prisma.academicOffering, "findUnique", async () => offering),
    replace(prisma.academicClassLeader, "findFirst", async ({ where }: { where: unknown }) => {
      const userId = (where as { membership: { userId: string } }).membership.userId;
      return userId === "leader" ? { id: "leader-assignment-1" } : null;
    }),
    replace(prisma.academicClassMembership, "findMany", async () => memberships),
    replace(prisma.academicOfferingPJ, "findMany", async () => pjs),
  ];
  const app = express();
  app.use("/api/v1/academic", academicRoutes);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const request = async (path: string, userId: string) => {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
        headers: { authorization: `Bearer ${jwt.sign({ userId }, config.jwtSecret)}` },
      });
      return { response, body: await response.json() };
    };

    for (const path of ["/api/v1/academic/memberships", "/api/v1/academic/pjs"]) {
      assert.equal((await request(path, "ordinary")).response.status, 403, path);
    }
    const coordinatorMemberships = await request("/api/v1/academic/memberships", "coordinator");
    assert.equal(coordinatorMemberships.response.status, 200);
    assert.deepEqual(coordinatorMemberships.body, { success: true, data: memberships });
    const coordinatorPjs = await request("/api/v1/academic/pjs", "coordinator");
    assert.equal(coordinatorPjs.response.status, 200);
    assert.deepEqual(coordinatorPjs.body, { success: true, data: pjs });

    const leaderMemberships = await request(`/api/v1/academic/offerings/${offeringId}/memberships`, "leader");
    assert.equal(leaderMemberships.response.status, 200);
    assert.deepEqual(leaderMemberships.body, { success: true, data: memberships });

    const leaderPjs = await request(`/api/v1/academic/offerings/${offeringId}/pjs`, "leader");
    assert.equal(leaderPjs.response.status, 200);
    assert.deepEqual(leaderPjs.body, { success: true, data: pjs });

    for (const userId of ["ordinary", "other-class-leader", "dosen"]) {
      const denied = await request(`/api/v1/academic/offerings/${offeringId}/memberships`, userId);
      assert.equal(denied.response.status, 403, userId);
      assert.deepEqual(denied.body, { success: false, message: userId === "dosen" ? "Anda tidak memiliki akses untuk resource ini." : "Ketua kelas aktif untuk term dan kelas ini diperlukan" });
    }

    const scopedCoordinatorPjs = await request(`/api/v1/academic/offerings/${offeringId}/pjs`, "coordinator");
    assert.equal(scopedCoordinatorPjs.response.status, 200);
    assert.deepEqual(scopedCoordinatorPjs.body, { success: true, data: pjs });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    restores.reverse().forEach((restore) => restore());
  }
});

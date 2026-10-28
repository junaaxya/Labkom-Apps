import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import prisma from "../config/database";
import academicRoutes from "./academic.routes";

const offeringId = "cmoseuhxj0001ofz5r10a18l1";
const scheduleId = "cmoseuhxj0002ofz5r10a18l2";

function replace(target: object, key: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, value });
  return () => descriptor ? Object.defineProperty(target, key, descriptor) : Reflect.deleteProperty(target, key);
}

test("binding HTTP endpoint requires coordinator and valid schedule ID", async () => {
  let writes = 0;
  const tx = {
    academicOffering: {
      findUnique: async ({ where }: { where: { id?: string } }) => where.id ? { id: offeringId, isActive: true, scheduleId: null } : null,
      update: async ({ data }: { data: { scheduleId: string } }) => { writes += 1; return { id: offeringId, ...data }; },
    },
    schedule: { findUnique: async () => ({ id: scheduleId, isActive: true, type: "PRAKTIKUM", status: "SCHEDULED" }) },
    auditLog: { create: async () => ({ id: "audit-1" }) },
  };
  const restores = [
    replace(prisma.user, "findUnique", async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      role: where.id === "coordinator" ? "KOORDINATOR_LAB" : "MAHASISWA",
      isActive: true,
      mustChangePassword: false,
    })),
    replace(prisma, "$transaction", async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)),
  ];
  const app = express();
  app.use(express.json());
  app.use("/api/v1/academic", academicRoutes);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/api/v1/academic/offerings/${offeringId}/schedule`;
    const request = (userId: string | null, body: object) => fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(userId ? { authorization: `Bearer ${jwt.sign({ userId }, config.jwtSecret)}` } : {}),
      },
      body: JSON.stringify(body),
    });
    assert.equal((await request(null, { scheduleId })).status, 401);
    assert.equal((await request("student", { scheduleId })).status, 403);
    assert.equal((await request("coordinator", { scheduleId: "invalid" })).status, 400);
    const response = await request("coordinator", { scheduleId });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, data: { id: offeringId, scheduleId } });
    assert.equal(writes, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    restores.reverse().forEach((restore) => restore());
  }
});

import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config";
import prisma from "../config/database";
import { getJakartaClock } from "../services/jakarta-time";
import logbookRoutes from "./logbook.routes";

function replace(target: object, key: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, value });
  return () => descriptor ? Object.defineProperty(target, key, descriptor) : Reflect.deleteProperty(target, key);
}

test("check-in HTTP requires valid identity and persisted staff role", async () => {
  const clock = getJakartaClock();
  const occurrenceDate = clock.date.toISOString().slice(0, 10);
  const writes: Record<string, unknown>[] = [];
  const transactions: unknown[] = [];
  const tx = {
    logbook: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => { writes.push(data); return { id: "logbook-1", ...data }; },
    },
    schedule: {
      findMany: async () => [{
        id: "schedule-1", labId: "lab-1", type: "PRAKTIKUM", status: "ONGOING", isActive: true,
        day: clock.day, specificDate: null, title: "Praktikum", startTime: "08:00", endTime: "10:00",
        academicOffering: { id: "offering-1", isActive: true }, occurrenceReleases: [],
      }],
    },
  };
  const restores = [
    replace(prisma.user, "findUnique", async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      role: where.id === "coordinator" ? "KOORDINATOR_LAB" : where.id === "assistant" ? "ASISTEN_LAB" : "MAHASISWA",
      isActive: true, mustChangePassword: false,
    })),
    replace(prisma, "$transaction", async (operation: (client: typeof tx) => Promise<unknown>, options: unknown) => {
      transactions.push(options); return operation(tx);
    }),
  ];
  const app = express();
  app.use(express.json());
  app.use("/api/v1/logbooks", logbookRoutes);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const request = (userId: string | null, body: object) => fetch(`http://127.0.0.1:${address.port}/api/v1/logbooks/checkin`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(userId ? { authorization: `Bearer ${jwt.sign({ userId, role: "KOORDINATOR_LAB" }, config.jwtSecret)}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const body = { labId: "lab-1", scheduleId: "schedule-1", occurrenceDate };
    assert.equal((await request(null, body)).status, 401);
    assert.equal((await request("student", body)).status, 403);
    assert.equal((await request("assistant", {})).status, 400);
    assert.equal((await request("assistant", { ...body, occurrenceDate: "2026-02-30" })).status, 400);
    assert.equal((await request("assistant", { ...body, scheduleId: "" })).status, 400);
    assert.equal(transactions.length, 0);
    for (const userId of ["assistant", "coordinator"]) {
      const response = await request(userId, body);
      assert.equal(response.status, 201);
      const payload = z.object({ data: z.object({
        labId: z.string(), scheduleId: z.string(), academicOfferingId: z.string(),
        occurrenceDate: z.string(), officialCheckinById: z.string(),
      }) }).parse(await response.json());
      assert.equal(payload.data.labId, "lab-1");
      assert.equal(payload.data.scheduleId, "schedule-1");
      assert.equal(payload.data.academicOfferingId, "offering-1");
      assert.equal(payload.data.occurrenceDate, clock.date.toISOString());
      assert.equal(payload.data.officialCheckinById, userId);
    }
    assert.deepEqual(transactions, [{ isolationLevel: "Serializable" }, { isolationLevel: "Serializable" }]);
    assert.equal(writes.length, 2);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    restores.reverse().forEach((restore) => restore());
  }
});

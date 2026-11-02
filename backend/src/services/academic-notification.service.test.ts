import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../config/database";
import { notifyAcademicOffering } from "./academic-notification.service";
import { notificationService } from "./notification.service";

function replaceProperty(target: object, property: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, value });
  return () => descriptor
    ? Object.defineProperty(target, property, descriptor)
    : Reflect.deleteProperty(target, property);
}

test("academic notifications include exact-term active class members and dedupe recipients", async () => {
  const created: Array<{ userId: string; reminderKey?: string | null }> = [];
  const restores = [
    replaceProperty(prisma.academicOffering, "findUnique", async () => ({
      termId: "term-1",
      classId: "class-1",
      dosenId: "dosen-1",
      pjs: [{ membership: { userId: "student-pj" } }],
      academicClass: {
        memberships: [
          { userId: "student-member", termId: "term-1" },
          { userId: "student-pj", termId: "term-1" },
          { userId: "student-other-term", termId: "term-2" },
        ],
      },
    })),
    replaceProperty(prisma.academicClassLeader, "findMany", async () => [
      { membership: { userId: "student-leader" } },
      { membership: { userId: "student-member" } },
    ]),
    replaceProperty(notificationService, "create", async (input: { userId: string; reminderKey?: string | null }) => {
      created.push(input);
      return { id: `notification-${created.length}` };
    }),
  ];

  try {
    await notifyAcademicOffering({
      offeringId: "offering-1",
      actorId: "student-leader",
      event: "report",
      eventId: "report-1",
      title: "Laporan diperbarui",
      message: "Status pertemuan berubah",
    });

    assert.deepEqual(created.map((item) => item.userId).sort(), ["dosen-1", "student-member", "student-pj"]);
    assert.equal(new Set(created.map((item) => item.userId)).size, created.length);
    assert.ok(created.every((item) => item.reminderKey === `academic:report:report-1:${item.userId}`));
    assert.ok(!created.some((item) => item.userId === "student-other-term"));
    assert.ok(!created.some((item) => item.userId === "student-leader"));
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../config/database";
import { MissionService } from "./mission.service";

test("MissionService.getLeaderboard returns flat name, userName, and user with fallback", async () => {
  const originalGroupBy = prisma.point.groupBy;
  const originalFindMany = prisma.user.findMany;

  try {
    (prisma.point as any).groupBy = async () => [
      { userId: "user-1", _sum: { amount: 120 } },
      { userId: "user-2", _sum: { amount: 80 } },
      { userId: "user-3", _sum: { amount: 50 } },
    ];

    (prisma.user as any).findMany = async () => [
      { id: "user-1", name: "Budi Aslab", avatar: "/avatars/budi.png" },
      { id: "user-2", name: "", avatar: null },
      // user-3 deleted / missing
    ];

    const leaderboard = await MissionService.getLeaderboard();

    assert.equal(leaderboard.length, 3);

    // user-1
    assert.equal(leaderboard[0].userId, "user-1");
    assert.equal(leaderboard[0].name, "Budi Aslab");
    assert.equal(leaderboard[0].userName, "Budi Aslab");
    assert.equal(leaderboard[0].user?.name, "Budi Aslab");
    assert.equal(leaderboard[0].totalPoints, 120);

    // user-2 (empty name fallback)
    assert.equal(leaderboard[1].userId, "user-2");
    assert.equal(leaderboard[1].name, "Asisten Lab");
    assert.equal(leaderboard[1].userName, "Asisten Lab");
    assert.equal(leaderboard[1].user?.name, "Asisten Lab");
    assert.equal(leaderboard[1].totalPoints, 80);

    // user-3 (missing user fallback)
    assert.equal(leaderboard[2].userId, "user-3");
    assert.equal(leaderboard[2].name, "Asisten Lab");
    assert.equal(leaderboard[2].userName, "Asisten Lab");
    assert.equal(leaderboard[2].user?.name, "Asisten Lab");
    assert.equal(leaderboard[2].totalPoints, 50);
  } finally {
    prisma.point.groupBy = originalGroupBy;
    prisma.user.findMany = originalFindMany;
  }
});

test("MissionService.getAllMissions maps claimedBy and includes sourceTicket", async () => {
  const originalTransaction = prisma.$transaction;

  try {
    (prisma as any).$transaction = async (promises: any[]) => {
      const mockItems = [
        {
          id: "mission-1",
          title: "Perbaiki PC-01",
          description: "Ganti mouse rusak",
          points: 15,
          status: "TAKEN",
          createdBy: { id: "admin-1", name: "Koordinator" },
          sourceTicket: {
            id: "ticket-101",
            category: "MOUSE",
            priority: "HIGH",
            lab: { id: "lab-1", name: "Lab Multimedia", location: "Gedung A" },
            pc: { id: "pc-1", pcCode: "PC-01", name: "PC-01" },
          },
          claims: [
            {
              asleb: { id: "aslab-1", name: "Citra Aslab" },
            },
          ],
          _count: { claims: 1 },
        },
      ];
      return [mockItems, 1];
    };

    const res = await MissionService.getAllMissions({ status: "TAKEN" });

    assert.equal(res.items.length, 1);
    const item = res.items[0];
    assert.equal(item.id, "mission-1");
    assert.equal(item.claimedBy, "Citra Aslab");
    assert.equal(item.claimantId, "aslab-1");
    assert.equal(item.sourceTicket?.lab?.name, "Lab Multimedia");
    assert.equal(item.sourceTicket?.pc?.pcCode, "PC-01");
  } finally {
    prisma.$transaction = originalTransaction;
  }
});

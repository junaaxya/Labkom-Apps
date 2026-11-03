export type LeaderboardRequester = { userId: string; role: string };

export function canViewLeaderboardDetail(requester: LeaderboardRequester, targetUserId: string): boolean {
  return requester.userId === targetUserId || requester.role === "KOORDINATOR_LAB";
}

export function isCompletedAttendanceStatus(status: string): boolean {
  return status === "CHECKED_OUT" || status === "APPROVED";
}

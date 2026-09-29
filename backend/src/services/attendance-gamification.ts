export type AttendancePointAward = {
  amount: number;
  reason: string;
  referenceId: string;
};

type AttendancePointInput = {
  attendanceId: string;
  status: string;
  checkedInStatus: string;
};

/**
 * Poin hanya diberikan setelah attendance selesai secara sah. Caller wajib
 * memanggil helper ini dari state transition atomik (checkout/approval), bukan
 * dari aksi check-in atau frontend.
 */
export function attendancePointAwards(input: AttendancePointInput): AttendancePointAward[] {
  if (input.status !== "CHECKED_OUT" && input.status !== "APPROVED") return [];

  const awards: AttendancePointAward[] = [
    {
      amount: 5,
      reason: "Kehadiran shift selesai",
      referenceId: `attendance:${input.attendanceId}:completed`,
    },
  ];

  // Hanya status asli CHECKED_IN yang berarti datang tidak terlambat.
  if (input.checkedInStatus === "CHECKED_IN") {
    awards.push({
      amount: 2,
      reason: "Bonus datang tepat waktu",
      referenceId: `attendance:${input.attendanceId}:on-time`,
    });
  }

  return awards;
}

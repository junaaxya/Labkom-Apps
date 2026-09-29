import { ScheduleService } from "../src/services/schedule.service";

function expectThrows(fn: () => void, expected: RegExp, label: string): void {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!expected.test(message)) {
      throw new Error(`${label}: pesan tidak sesuai: ${message}`);
    }
    return;
  }
  throw new Error(`${label}: seharusnya melempar error`);
}

ScheduleService.assertValidTimeInterval("08:00", "09:30");
expectThrows(
  () => ScheduleService.assertValidTimeInterval("09:00", "09:00"),
  /lebih besar dari jam mulai/i,
  "waktu sama ditolak",
);
expectThrows(
  () => ScheduleService.assertValidTimeInterval("10:00", "09:00"),
  /lebih besar dari jam mulai/i,
  "waktu mundur ditolak",
);
expectThrows(
  () => ScheduleService.assertValidTimeInterval("9:00", "10:00"),
  /format waktu/i,
  "format tidak baku ditolak",
);

const labConflict = ScheduleService.conflictMessage("LAB", "Praktikum Basis Data", "08:00", "10:00");
if (!/bentrok pada lab/i.test(labConflict)) throw new Error(`Pesan konflik lab tidak sesuai: ${labConflict}`);

console.log("Schedule integrity tests passed");

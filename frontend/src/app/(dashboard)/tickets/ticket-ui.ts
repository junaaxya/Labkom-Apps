import type { TicketStatus } from "@/types";

export const ticketStatuses: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "REJECTED"];

export const ticketStatusLabel: Record<TicketStatus, string> = {
  OPEN: "Terbuka",
  IN_PROGRESS: "Sedang Diproses",
  WAITING: "Menunggu",
  RESOLVED: "Selesai",
  REJECTED: "Ditolak",
};

export const ticketStatusClass: Record<TicketStatus, string> = {
  OPEN: "bg-[#f3701e] text-white",
  IN_PROGRESS: "bg-[#4b607f] text-white",
  WAITING: "bg-yellow-300 text-[#1a1a1a]",
  RESOLVED: "bg-green-500 text-white",
  REJECTED: "bg-red-500 text-white",
};

export const ticketCategoryLabel: Record<string, string> = {
  MOUSE: "Mouse", KEYBOARD: "Keyboard", MONITOR: "Monitor", CPU: "CPU", JARINGAN: "Jaringan",
  SOFTWARE: "Perangkat Lunak", KURSI_MEJA: "Kursi/Meja", AC_LISTRIK: "AC/Listrik", PROYEKTOR: "Proyektor", LAINNYA: "Lainnya",
};

export function isConflict(error: unknown): boolean {
  return error instanceof Error && /409|conflict|berubah|status/i.test(error.message);
}

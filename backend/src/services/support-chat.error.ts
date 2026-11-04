const errorDetails = {
  PC_NOT_FOUND: { statusCode: 404, message: "PC tidak ditemukan" },
  CHAT_NOT_FOUND: { statusCode: 404, message: "Chat dukungan tidak ditemukan" },
  NOT_PARTICIPANT: { statusCode: 403, message: "Anda tidak memiliki akses ke chat dukungan ini" },
  NO_ACTIVE_ASSISTANT: { statusCode: 409, message: "Tidak ada Asisten Lab aktif untuk menerima chat dukungan" },
  NO_CURRENT_DUTY: { statusCode: 409, message: "Tidak ada Asisten Lab yang sedang bertugas untuk lab ini" },
  CLAIM_LOST: { statusCode: 409, message: "Chat sudah diambil oleh asisten lain" },
  CLAIM_REQUIRED: { statusCode: 409, message: "Klaim chat terlebih dahulu sebelum mengirim balasan" },
} as const;

export type SupportChatErrorCode = keyof typeof errorDetails;

export class SupportChatError extends Error {
  readonly statusCode: number;
  readonly code: SupportChatErrorCode;

  constructor(code: SupportChatErrorCode) {
    const detail = errorDetails[code];
    super(detail.message);
    this.name = "SupportChatError";
    this.code = code;
    this.statusCode = detail.statusCode;
  }
}

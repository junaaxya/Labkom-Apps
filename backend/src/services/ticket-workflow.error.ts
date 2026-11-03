export class TicketConflictError extends Error {
  readonly name: string = "TicketConflictError";

  constructor(message: string) {
    super(message);
  }
}

export class TicketDuplicateError extends TicketConflictError {
  readonly name = "TicketDuplicateError";

  constructor(
    readonly existingTicket: {
      readonly id: string;
      readonly status: string;
      readonly createdAt: Date;
      readonly reportedBy: string;
    }
  ) {
    super("Laporan aktif serupa sudah ada untuk PC dan masalah ini.");
  }
}

export class TicketNotFoundError extends Error {
  readonly name = "TicketNotFoundError";

  constructor(message: string) {
    super(message);
  }
}

export class TicketAuthorizationError extends Error {
  readonly name = "TicketAuthorizationError";

  constructor(message: string) {
    super(message);
  }
}

export class TicketValidationError extends Error {
  readonly name = "TicketValidationError";

  constructor(message: string) {
    super(message);
  }
}

export function assertNeverTicketState(value: never): never {
  throw new TicketConflictError(`Status ticket tidak didukung: ${String(value)}`);
}

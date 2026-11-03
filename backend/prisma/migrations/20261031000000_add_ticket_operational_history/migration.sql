ALTER TABLE "tickets" ADD COLUMN "resolutionNotes" TEXT;
ALTER TABLE "tickets" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "tickets" ADD COLUMN "waitingReason" TEXT;

CREATE TABLE "ticket_events" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "fromStatus" "TicketStatus",
  "toStatus" "TicketStatus",
  "fromAssigneeId" TEXT,
  "toAssigneeId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ticket_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ticket_events_ticketId_createdAt_idx"
  ON "ticket_events"("ticketId", "createdAt");
CREATE INDEX "ticket_events_actorId_createdAt_idx"
  ON "ticket_events"("actorId", "createdAt");

ALTER TABLE "ticket_events"
  ADD CONSTRAINT "ticket_events_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "tickets"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ticket_events"
  ADD CONSTRAINT "ticket_events_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

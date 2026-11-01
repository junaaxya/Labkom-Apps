CREATE TYPE "LogbookTicketAutomationStatus" AS ENUM ('CREATED', 'DUPLICATE', 'FAILED');

ALTER TABLE "tickets"
ADD COLUMN "activeDuplicateKey" TEXT,
ADD COLUMN "sourceLogbookConditionId" TEXT;

ALTER TABLE "missions"
ADD COLUMN "sourceTicketId" TEXT;

CREATE TABLE "logbook_ticket_automation_attempts" (
    "id" TEXT NOT NULL,
    "logbookConditionId" TEXT NOT NULL,
    "ticketId" TEXT,
    "status" "LogbookTicketAutomationStatus" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logbook_ticket_automation_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tickets_activeDuplicateKey_key" ON "tickets"("activeDuplicateKey");
CREATE UNIQUE INDEX "tickets_sourceLogbookConditionId_key" ON "tickets"("sourceLogbookConditionId");
CREATE UNIQUE INDEX "missions_sourceTicketId_key" ON "missions"("sourceTicketId");
CREATE INDEX "logbook_ticket_automation_attempts_logbookConditionId_createdAt_idx"
ON "logbook_ticket_automation_attempts"("logbookConditionId", "createdAt");
CREATE INDEX "logbook_ticket_automation_attempts_status_createdAt_idx"
ON "logbook_ticket_automation_attempts"("status", "createdAt");
CREATE INDEX "logbook_ticket_automation_attempts_ticketId_idx"
ON "logbook_ticket_automation_attempts"("ticketId");

ALTER TABLE "tickets"
ADD CONSTRAINT "tickets_sourceLogbookConditionId_fkey"
FOREIGN KEY ("sourceLogbookConditionId") REFERENCES "logbook_conditions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "missions"
ADD CONSTRAINT "missions_sourceTicketId_fkey"
FOREIGN KEY ("sourceTicketId") REFERENCES "tickets"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "logbook_ticket_automation_attempts"
ADD CONSTRAINT "logbook_ticket_automation_attempts_logbookConditionId_fkey"
FOREIGN KEY ("logbookConditionId") REFERENCES "logbook_conditions"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "logbook_ticket_automation_attempts"
ADD CONSTRAINT "logbook_ticket_automation_attempts_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "tickets"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

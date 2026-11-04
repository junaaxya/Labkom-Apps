ALTER TABLE "support_chat_recipients" ALTER COLUMN "shiftScheduleId" DROP NOT NULL;

ALTER TABLE "support_chat_messages"
    ADD COLUMN "deliveredAt" TIMESTAMP(3),
    ADD COLUMN "readAt" TIMESTAMP(3);

CREATE TYPE "SupportChatStatus" AS ENUM ('WAITING', 'HANDLED');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUPPORT_CHAT_ASSIGNED';

CREATE TABLE "support_chats" (
    "id" TEXT NOT NULL,
    "pcId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assignedAssistantId" TEXT,
    "status" "SupportChatStatus" NOT NULL DEFAULT 'WAITING',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_chats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_chat_messages" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "support_chat_recipients" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "assistantId" TEXT NOT NULL,
    "shiftScheduleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_chat_recipients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_chats_studentId_lastMessageAt_idx" ON "support_chats"("studentId", "lastMessageAt");
CREATE INDEX "support_chats_assignedAssistantId_status_lastMessageAt_idx" ON "support_chats"("assignedAssistantId", "status", "lastMessageAt");
CREATE INDEX "support_chats_labId_createdAt_idx" ON "support_chats"("labId", "createdAt");
CREATE UNIQUE INDEX "support_chat_recipients_chatId_assistantId_key" ON "support_chat_recipients"("chatId", "assistantId");
CREATE INDEX "support_chat_recipients_assistantId_chatId_idx" ON "support_chat_recipients"("assistantId", "chatId");
CREATE INDEX "support_chat_recipients_shiftScheduleId_idx" ON "support_chat_recipients"("shiftScheduleId");
CREATE INDEX "support_chat_messages_chatId_createdAt_id_idx" ON "support_chat_messages"("chatId", "createdAt", "id");

ALTER TABLE "support_chats" ADD CONSTRAINT "support_chats_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "pcs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_chats" ADD CONSTRAINT "support_chats_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_chats" ADD CONSTRAINT "support_chats_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_chats" ADD CONSTRAINT "support_chats_assignedAssistantId_fkey" FOREIGN KEY ("assignedAssistantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_chat_recipients" ADD CONSTRAINT "support_chat_recipients_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "support_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_chat_recipients" ADD CONSTRAINT "support_chat_recipients_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_chat_recipients" ADD CONSTRAINT "support_chat_recipients_shiftScheduleId_fkey" FOREIGN KEY ("shiftScheduleId") REFERENCES "aslab_shift_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_chat_messages" ADD CONSTRAINT "support_chat_messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "support_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_chat_messages" ADD CONSTRAINT "support_chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

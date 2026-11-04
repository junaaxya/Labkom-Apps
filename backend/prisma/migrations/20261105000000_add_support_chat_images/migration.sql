ALTER TABLE "support_chat_messages"
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "imageMimeType" TEXT,
ADD COLUMN "imageSize" INTEGER,
ADD COLUMN "imageExpiresAt" TIMESTAMP(3);

CREATE INDEX "support_chat_messages_imageExpiresAt_idx"
ON "support_chat_messages"("imageExpiresAt");

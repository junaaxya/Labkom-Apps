CREATE TABLE "native_push_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "deviceName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "native_push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "native_push_tokens_token_key" ON "native_push_tokens"("token");
CREATE INDEX "native_push_tokens_userId_idx" ON "native_push_tokens"("userId");
CREATE INDEX "native_push_tokens_updatedAt_idx" ON "native_push_tokens"("updatedAt");
ALTER TABLE "native_push_tokens" ADD CONSTRAINT "native_push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

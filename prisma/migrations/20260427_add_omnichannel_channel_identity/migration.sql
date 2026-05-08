ALTER TABLE "Conversation"
ADD COLUMN IF NOT EXISTS "lastInboundChannel" TEXT;

ALTER TABLE "Message"
ADD COLUMN IF NOT EXISTS "externalUserId" TEXT,
ADD COLUMN IF NOT EXISTS "deliveryStatus" TEXT;

CREATE TABLE IF NOT EXISTS "ChannelIdentity" (
  "id" TEXT NOT NULL,
  "externalUserId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelIdentity_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ChannelIdentity_clientId_fkey'
  ) THEN
    ALTER TABLE "ChannelIdentity"
    ADD CONSTRAINT "ChannelIdentity_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ChannelIdentity_conversationId_fkey'
  ) THEN
    ALTER TABLE "ChannelIdentity"
    ADD CONSTRAINT "ChannelIdentity_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ChannelIdentity_externalUserId_channel_tenantId_unitId_key"
ON "ChannelIdentity"("externalUserId", "channel", "tenantId", "unitId");

CREATE INDEX IF NOT EXISTS "ChannelIdentity_clientId_idx"
ON "ChannelIdentity"("clientId");

CREATE INDEX IF NOT EXISTS "ChannelIdentity_conversationId_idx"
ON "ChannelIdentity"("conversationId");

CREATE INDEX IF NOT EXISTS "ChannelIdentity_tenantId_idx"
ON "ChannelIdentity"("tenantId");

CREATE INDEX IF NOT EXISTS "ChannelIdentity_unitId_idx"
ON "ChannelIdentity"("unitId");

CREATE INDEX IF NOT EXISTS "Conversation_clientId_idx"
ON "Conversation"("clientId");

CREATE INDEX IF NOT EXISTS "Conversation_enquiryId_idx"
ON "Conversation"("enquiryId");

CREATE INDEX IF NOT EXISTS "Message_externalUserId_channel_idx"
ON "Message"("externalUserId", "channel");

CREATE INDEX IF NOT EXISTS "Message_tenantId_channel_externalMessageId_idx"
ON "Message"("tenantId", "channel", "externalMessageId");

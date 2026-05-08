CREATE UNIQUE INDEX IF NOT EXISTS "Message_tenantId_unitId_channel_externalMessageId_key"
ON "Message"("tenantId", "unitId", "channel", "externalMessageId")
WHERE "externalMessageId" IS NOT NULL;

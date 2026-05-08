CREATE TABLE IF NOT EXISTS "CallHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "unitId" TEXT,
    "conversationId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT NOT NULL,
    "agentName" TEXT,
    "agentEmail" TEXT,
    "provider" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "duration" INTEGER,
    "recordingUrl" TEXT,
    "callSid" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CallHistory_callSid_key" ON "CallHistory"("callSid");
CREATE INDEX IF NOT EXISTS "CallHistory_customerPhone_idx" ON "CallHistory"("customerPhone");
CREATE INDEX IF NOT EXISTS "CallHistory_conversationId_idx" ON "CallHistory"("conversationId");
CREATE INDEX IF NOT EXISTS "CallHistory_startedAt_idx" ON "CallHistory"("startedAt");
CREATE INDEX IF NOT EXISTS "CallHistory_tenantId_unitId_idx" ON "CallHistory"("tenantId", "unitId");

-- Alpha Space (coaching ejecutivo guiado por IA)
CREATE TABLE "AlphaSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "framework" TEXT NOT NULL DEFAULT 'strategic_dialogue',
    "challenge" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "step" INTEGER NOT NULL DEFAULT 0,
    "documentJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AlphaSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AlphaSession_userId_createdAt_idx" ON "AlphaSession"("userId", "createdAt");
CREATE INDEX "AlphaSession_workspaceId_createdAt_idx" ON "AlphaSession"("workspaceId", "createdAt");
ALTER TABLE "AlphaSession" ADD CONSTRAINT "AlphaSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlphaSession" ADD CONSTRAINT "AlphaSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AlphaMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlphaMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AlphaMessage_sessionId_createdAt_idx" ON "AlphaMessage"("sessionId", "createdAt");
ALTER TABLE "AlphaMessage" ADD CONSTRAINT "AlphaMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AlphaSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AlphaDocument" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'decision_brief',
    "sections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlphaDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AlphaDocument_sessionId_key" ON "AlphaDocument"("sessionId");
CREATE INDEX "AlphaDocument_userId_updatedAt_idx" ON "AlphaDocument"("userId", "updatedAt");
ALTER TABLE "AlphaDocument" ADD CONSTRAINT "AlphaDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlphaDocument" ADD CONSTRAINT "AlphaDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlphaDocument" ADD CONSTRAINT "AlphaDocument_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AlphaSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Feedback Intelligence (retroalimentación anónima)
CREATE TABLE "FeedbackCampaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'pulse',
    "questions" JSONB NOT NULL,
    "cadence" TEXT NOT NULL DEFAULT 'weekly',
    "status" TEXT NOT NULL DEFAULT 'active',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackCampaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FeedbackCampaign_workspaceId_status_idx" ON "FeedbackCampaign"("workspaceId", "status");
CREATE INDEX "FeedbackCampaign_workspaceId_createdAt_idx" ON "FeedbackCampaign"("workspaceId", "createdAt");
ALTER TABLE "FeedbackCampaign" ADD CONSTRAINT "FeedbackCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FeedbackResponse" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "submitterHash" TEXT,
    "payload" JSONB NOT NULL,
    "sentiment" TEXT,
    "emotion" TEXT,
    "scores" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackResponse_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FeedbackResponse_campaignId_createdAt_idx" ON "FeedbackResponse"("campaignId", "createdAt");
CREATE INDEX "FeedbackResponse_workspaceId_sentiment_idx" ON "FeedbackResponse"("workspaceId", "sentiment");
CREATE INDEX "FeedbackResponse_workspaceId_createdAt_idx" ON "FeedbackResponse"("workspaceId", "createdAt");
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "FeedbackCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

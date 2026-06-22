-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "hashtag" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "industry" TEXT,
ADD COLUMN "category" TEXT,
ADD COLUMN "emoji" TEXT DEFAULT '🚀',
ADD COLUMN "teamSize" TEXT;

-- Backfill existing rows so the NOT NULL constraint can be applied.
-- Slug is already unique and required, so we reuse it for the hashtag.
UPDATE "Workspace" SET "hashtag" = '#' || "slug" WHERE "hashtag" IS NULL;

ALTER TABLE "Workspace" ALTER COLUMN "hashtag" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_hashtag_key" ON "Workspace"("hashtag");

-- CreateTable
CREATE TABLE "JoinRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JoinRequest_workspaceId_userId_key" ON "JoinRequest"("workspaceId", "userId");
CREATE INDEX "JoinRequest_status_idx" ON "JoinRequest"("status");

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

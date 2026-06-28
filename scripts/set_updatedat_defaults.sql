-- Set DEFAULT now() on every "updatedAt" column.
--
-- Drizzle's schema declares updatedAt as .defaultNow().notNull(), but this DB
-- was originally created by Prisma (which manages @updatedAt in app space, so
-- the column has no DB-level default). `drizzle-kit push` reconciles most
-- schema drift but does NOT issue ALTER ... SET DEFAULT for existing columns,
-- so inserts that rely on the DB default (e.g. SaveArtifactContent creating a
-- KnowledgeCategory/KnowledgeResource) send NULL and fail with SQLSTATE 23502.
--
-- This is the prod counterpart of drizzle/0001_set_updatedat_defaults.sql
-- (which is only consumed by `drizzle-kit migrate` in tests). Idempotent.

ALTER TABLE "User" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "UserProfile" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Membership" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "Goal" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "WorkspaceSubscription" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "ProjectSmartGoal" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "ProjectMethodology" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "ProjectKpi" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "ProjectInvitation" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "ProjectTask" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "ProjectPhaseState" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "ProjectArtifactState" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "EmployeeSkill" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "AlphaSession" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "AlphaDocument" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "KnowledgeCategory" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "KnowledgeResource" ALTER COLUMN "updatedAt" SET DEFAULT now();
ALTER TABLE "FeedbackCampaign" ALTER COLUMN "updatedAt" SET DEFAULT now();

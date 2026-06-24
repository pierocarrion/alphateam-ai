-- Team Insights (People Analytics) module
-- Adds: Membership.seniority/hireDate, Task.workedMinutes,
--       AuditLog relation, LearningActivity, Survey, EmployeeSkill.

-- Membership: seniority + hireDate
ALTER TABLE "Membership" ADD COLUMN "seniority" TEXT;
ALTER TABLE "Membership" ADD COLUMN "hireDate" TIMESTAMP(3);
CREATE INDEX "Membership_workspaceId_role_idx" ON "Membership"("workspaceId", "role");

-- Task: worked minutes
ALTER TABLE "Task" ADD COLUMN "workedMinutes" INTEGER;

-- AuditLog: missing workspace relation (clean orphan workspaceIds before FK)
UPDATE "AuditLog" SET "workspaceId" = NULL
 WHERE "workspaceId" IS NOT NULL
   AND "workspaceId" NOT IN (SELECT "id" FROM "Workspace");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- LearningActivity
CREATE TABLE "LearningActivity" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "skill"       TEXT,
    "level"       TEXT,
    "hours"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt"   TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LearningActivity_workspaceId_completedAt_idx" ON "LearningActivity"("workspaceId", "completedAt");
CREATE INDEX "LearningActivity_userId_completedAt_idx" ON "LearningActivity"("userId", "completedAt");
CREATE INDEX "LearningActivity_workspaceId_skill_idx" ON "LearningActivity"("workspaceId", "skill");

ALTER TABLE "LearningActivity"
  ADD CONSTRAINT "LearningActivity_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "LearningActivity"
  ADD CONSTRAINT "LearningActivity_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

-- Survey
CREATE TABLE "Survey" (
    "id"                  TEXT NOT NULL,
    "userId"              TEXT NOT NULL,
    "workspaceId"         TEXT NOT NULL,
    "psychologicalSafety" INTEGER NOT NULL,
    "sentiment"           TEXT NOT NULL,
    "comment"             TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Survey_workspaceId_createdAt_idx" ON "Survey"("workspaceId", "createdAt");
CREATE INDEX "Survey_userId_createdAt_idx" ON "Survey"("userId", "createdAt");

ALTER TABLE "Survey"
  ADD CONSTRAINT "Survey_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "Survey"
  ADD CONSTRAINT "Survey_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

-- EmployeeSkill
CREATE TABLE "EmployeeSkill" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "skill"       TEXT NOT NULL,
    "level"       TEXT NOT NULL,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSkill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeSkill_userId_workspaceId_skill_key"
  ON "EmployeeSkill"("userId", "workspaceId", "skill");
CREATE INDEX "EmployeeSkill_workspaceId_skill_idx"
  ON "EmployeeSkill"("workspaceId", "skill");

ALTER TABLE "EmployeeSkill"
  ADD CONSTRAINT "EmployeeSkill_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "EmployeeSkill"
  ADD CONSTRAINT "EmployeeSkill_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE;

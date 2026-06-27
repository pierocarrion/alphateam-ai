-- Extend ProjectTask with optional phase/artifact linkage
ALTER TABLE "ProjectTask" ADD COLUMN "phaseKey" TEXT;
ALTER TABLE "ProjectTask" ADD COLUMN "artifactKey" TEXT;

-- CreateTable: ProjectPhaseState
CREATE TABLE "ProjectPhaseState" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "methodologyKey" TEXT NOT NULL,
    "phaseKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPhaseState_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProjectArtifactState
CREATE TABLE "ProjectArtifactState" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "methodologyKey" TEXT NOT NULL,
    "phaseKey" TEXT NOT NULL,
    "artifactKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "filledContent" TEXT,
    "knowledgeResourceId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectArtifactState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPhaseState_workspaceId_methodologyKey_phaseKey_key"
    ON "ProjectPhaseState"("workspaceId", "methodologyKey", "phaseKey");

-- CreateIndex
CREATE INDEX "ProjectPhaseState_workspaceId_methodologyKey_idx"
    ON "ProjectPhaseState"("workspaceId", "methodologyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectArtifactState_workspaceId_artifactKey_key"
    ON "ProjectArtifactState"("workspaceId", "artifactKey");

-- CreateIndex
CREATE INDEX "ProjectArtifactState_workspaceId_phaseKey_idx"
    ON "ProjectArtifactState"("workspaceId", "phaseKey");

-- CreateIndex
CREATE INDEX "ProjectArtifactState_workspaceId_status_idx"
    ON "ProjectArtifactState"("workspaceId", "status");

-- AddForeignKey: ProjectPhaseState -> Workspace
ALTER TABLE "ProjectPhaseState"
    ADD CONSTRAINT "ProjectPhaseState_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ProjectArtifactState -> Workspace
ALTER TABLE "ProjectArtifactState"
    ADD CONSTRAINT "ProjectArtifactState_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ProjectArtifactState -> ProjectPhaseState
ALTER TABLE "ProjectArtifactState"
    ADD CONSTRAINT "ProjectArtifactState_phaseId_fkey"
    FOREIGN KEY ("phaseId") REFERENCES "ProjectPhaseState"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ProjectArtifactState -> KnowledgeResource
ALTER TABLE "ProjectArtifactState"
    ADD CONSTRAINT "ProjectArtifactState_knowledgeResourceId_fkey"
    FOREIGN KEY ("knowledgeResourceId") REFERENCES "KnowledgeResource"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

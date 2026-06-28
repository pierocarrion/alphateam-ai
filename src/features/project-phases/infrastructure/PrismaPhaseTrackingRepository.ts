import { db } from "@/server/lib/db";
import {
  projectPhaseState,
  projectArtifactState,
} from "@drizzle/schema";
import { eq, and, asc } from "drizzle-orm";
import type {
  ArtifactStatus,
  PhaseStatus,
  ProjectArtifactState,
  ProjectPhaseState,
} from "../domain/entities";
import type { IPhaseTrackingRepository } from "../domain/repositories";

function toDate(v: Date | null | undefined): string | null {
  return v ? v.toISOString() : null;
}

function toPhase(row: {
  id: string;
  workspaceId: string;
  methodologyKey: string;
  phaseKey: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ProjectPhaseState {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    methodologyKey: row.methodologyKey,
    phaseKey: row.phaseKey,
    status: row.status as PhaseStatus,
    startedAt: toDate(row.startedAt),
    completedAt: toDate(row.completedAt),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toArtifact(row: {
  id: string;
  workspaceId: string;
  phaseId: string;
  methodologyKey: string;
  phaseKey: string;
  artifactKey: string;
  status: string;
  mandatory: boolean;
  visible: boolean;
  filledContent: string | null;
  knowledgeResourceId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ProjectArtifactState {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    phaseId: row.phaseId,
    methodologyKey: row.methodologyKey,
    phaseKey: row.phaseKey,
    artifactKey: row.artifactKey,
    status: row.status as ArtifactStatus,
    mandatory: row.mandatory,
    visible: row.visible,
    filledContent: row.filledContent,
    knowledgeResourceId: row.knowledgeResourceId,
    startedAt: toDate(row.startedAt),
    completedAt: toDate(row.completedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaPhaseTrackingRepository implements IPhaseTrackingRepository {
  async listPhases(
    workspaceId: string,
    methodologyKey: string
  ): Promise<ProjectPhaseState[]> {
    const rows = await db.query.projectPhaseState.findMany({
      where: and(
        eq(projectPhaseState.workspaceId, workspaceId),
        eq(projectPhaseState.methodologyKey, methodologyKey)
      ),
      orderBy: asc(projectPhaseState.createdAt),
    });
    return rows.map(toPhase);
  }

  async listArtifacts(workspaceId: string): Promise<ProjectArtifactState[]> {
    const rows = await db.query.projectArtifactState.findMany({
      where: eq(projectArtifactState.workspaceId, workspaceId),
      orderBy: asc(projectArtifactState.createdAt),
    });
    return rows.map(toArtifact);
  }

  async upsertPhase(
    workspaceId: string,
    methodologyKey: string,
    phaseKey: string,
    patch: {
      status?: PhaseStatus;
      notes?: string | null;
      startedAt?: Date | null;
      completedAt?: Date | null;
    }
  ): Promise<ProjectPhaseState> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.status !== undefined) updateData.status = patch.status;
    if (patch.notes !== undefined) updateData.notes = patch.notes;
    if (patch.startedAt !== undefined) updateData.startedAt = patch.startedAt;
    if (patch.completedAt !== undefined) updateData.completedAt = patch.completedAt;

    const [row] = await db
      .insert(projectPhaseState)
      .values({
        workspaceId,
        methodologyKey,
        phaseKey,
        status: (patch.status as PhaseStatus) ?? "not_started",
        notes: patch.notes ?? null,
        startedAt: patch.startedAt ?? null,
        completedAt: patch.completedAt ?? null,
      })
      .onConflictDoUpdate({
        target: [
          projectPhaseState.workspaceId,
          projectPhaseState.methodologyKey,
          projectPhaseState.phaseKey,
        ],
        set: updateData,
      })
      .returning();
    return toPhase(row!);
  }

  async upsertArtifact(
    workspaceId: string,
    input: {
      methodologyKey: string;
      phaseKey: string;
      artifactKey: string;
      status?: ArtifactStatus;
      mandatory?: boolean;
      visible?: boolean;
      filledContent?: string | null;
      knowledgeResourceId?: string | null;
      startedAt?: Date;
      completedAt?: Date | null;
    }
  ): Promise<ProjectArtifactState> {
    const [phase] = await db
      .insert(projectPhaseState)
      .values({
        workspaceId,
        methodologyKey: input.methodologyKey,
        phaseKey: input.phaseKey,
        status: "not_started",
      })
      .onConflictDoUpdate({
        target: [
          projectPhaseState.workspaceId,
          projectPhaseState.methodologyKey,
          projectPhaseState.phaseKey,
        ],
        set: { updatedAt: new Date() },
      })
      .returning({ id: projectPhaseState.id });

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.status !== undefined) updateData.status = input.status;
    if (input.mandatory !== undefined) updateData.mandatory = input.mandatory;
    if (input.visible !== undefined) updateData.visible = input.visible;
    if (input.filledContent !== undefined) updateData.filledContent = input.filledContent;
    if (input.knowledgeResourceId !== undefined)
      updateData.knowledgeResourceId = input.knowledgeResourceId;
    if (input.startedAt !== undefined) updateData.startedAt = input.startedAt;
    if (input.completedAt !== undefined) updateData.completedAt = input.completedAt;

    const [row] = await db
      .insert(projectArtifactState)
      .values({
        workspaceId,
        phaseId: phase!.id,
        methodologyKey: input.methodologyKey,
        phaseKey: input.phaseKey,
        artifactKey: input.artifactKey,
        status: input.status ?? "pending",
        mandatory: input.mandatory ?? false,
        visible: input.visible ?? true,
        filledContent: input.filledContent ?? null,
        knowledgeResourceId: input.knowledgeResourceId ?? null,
        startedAt: input.startedAt ?? null,
        completedAt: input.completedAt ?? null,
      })
      .onConflictDoUpdate({
        target: [
          projectArtifactState.workspaceId,
          projectArtifactState.artifactKey,
        ],
        set: updateData,
      })
      .returning();
    return toArtifact(row!);
  }

  async seedForMethodology(
    workspaceId: string,
    methodologyKey: string,
    phases: Array<{ phaseKey: string }>
  ): Promise<void> {
    if (phases.length === 0) return;
    await db.transaction(async (tx) => {
      for (const p of phases) {
        await tx
          .insert(projectPhaseState)
          .values({
            workspaceId,
            methodologyKey,
            phaseKey: p.phaseKey,
            status: "not_started",
          })
          .onConflictDoUpdate({
            target: [
              projectPhaseState.workspaceId,
              projectPhaseState.methodologyKey,
              projectPhaseState.phaseKey,
            ],
            set: { updatedAt: new Date() },
          });
      }
    });
  }
}

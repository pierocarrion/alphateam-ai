import { prisma } from "@/server/lib/prisma";
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
    const rows = await prisma.projectPhaseState.findMany({
      where: { workspaceId, methodologyKey },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toPhase);
  }

  async listArtifacts(workspaceId: string): Promise<ProjectArtifactState[]> {
    const rows = await prisma.projectArtifactState.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
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
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.notes !== undefined) data.notes = patch.notes;
    if (patch.startedAt !== undefined) data.startedAt = patch.startedAt;
    if (patch.completedAt !== undefined) data.completedAt = patch.completedAt;

    const row = await prisma.projectPhaseState.upsert({
      where: {
        workspaceId_methodologyKey_phaseKey: { workspaceId, methodologyKey, phaseKey },
      },
      create: {
        workspaceId,
        methodologyKey,
        phaseKey,
        status: (patch.status as PhaseStatus) ?? "not_started",
        notes: patch.notes ?? null,
        startedAt: patch.startedAt ?? null,
        completedAt: patch.completedAt ?? null,
      },
      update: data,
    });
    return toPhase(row);
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
    // Asegura que la fase exista (la creamos lazy si no existe aún).
    const phase = await prisma.projectPhaseState.upsert({
      where: {
        workspaceId_methodologyKey_phaseKey: {
          workspaceId,
          methodologyKey: input.methodologyKey,
          phaseKey: input.phaseKey,
        },
      },
      create: {
        workspaceId,
        methodologyKey: input.methodologyKey,
        phaseKey: input.phaseKey,
        status: "not_started",
      },
      update: {},
      select: { id: true },
    });

    const updateData: Record<string, unknown> = {};
    if (input.status !== undefined) updateData.status = input.status;
    if (input.mandatory !== undefined) updateData.mandatory = input.mandatory;
    if (input.visible !== undefined) updateData.visible = input.visible;
    if (input.filledContent !== undefined) updateData.filledContent = input.filledContent;
    if (input.knowledgeResourceId !== undefined)
      updateData.knowledgeResourceId = input.knowledgeResourceId;
    if (input.startedAt !== undefined) updateData.startedAt = input.startedAt;
    if (input.completedAt !== undefined) updateData.completedAt = input.completedAt;

    const row = await prisma.projectArtifactState.upsert({
      where: {
        workspaceId_artifactKey: { workspaceId, artifactKey: input.artifactKey },
      },
      create: {
        workspaceId,
        phaseId: phase.id,
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
      },
      update: updateData,
    });
    return toArtifact(row);
  }

  async seedForMethodology(
    workspaceId: string,
    methodologyKey: string,
    phases: Array<{ phaseKey: string }>
  ): Promise<void> {
    if (phases.length === 0) return;
    await prisma.$transaction(
      phases.map((p) =>
        prisma.projectPhaseState.upsert({
          where: {
            workspaceId_methodologyKey_phaseKey: {
              workspaceId,
              methodologyKey,
              phaseKey: p.phaseKey,
            },
          },
          create: {
            workspaceId,
            methodologyKey,
            phaseKey: p.phaseKey,
            status: "not_started",
          },
          update: {},
        })
      )
    );
  }
}

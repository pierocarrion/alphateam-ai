import { describe, expect, it } from "vitest";
import { SaveArtifactContent } from "./SaveArtifactContent";
import type { IPhaseTrackingRepository } from "../../domain/repositories";
import type { ProjectPhaseConfig, ProjectPhaseState, ProjectArtifactState } from "../../domain/entities";
import type { IKnowledgeRepository } from "@/features/knowledge/domain/repositories/IKnowledgeRepository";
import type {
  IAuditRepository,
  AuditEntry,
} from "@/features/project-settings/domain/repositories";

function makeInMemoryPhaseRepo(opts?: {
  phases?: ProjectPhaseState[];
  config?: ProjectPhaseConfig | null;
}): IPhaseTrackingRepository & {
  artifacts: ProjectArtifactState[];
  phases: ProjectPhaseState[];
} {
  const artifacts: ProjectArtifactState[] = [];
  const phases: ProjectPhaseState[] = opts?.phases ? [...opts.phases] : [];
  let config: ProjectPhaseConfig | null = opts?.config ?? null;
  const repo: IPhaseTrackingRepository & {
    artifacts: ProjectArtifactState[];
    phases: ProjectPhaseState[];
  } = {
    artifacts,
    phases,
    async listPhases() {
      return phases;
    },
    async listArtifacts() {
      return artifacts;
    },
    async upsertPhase(_ws, _mk, pk, patch) {
      const existing = phases.find((p) => p.phaseKey === pk);
      const merged: ProjectPhaseState = {
        id: existing?.id ?? "phase-1",
        workspaceId: _ws,
        methodologyKey: _mk,
        phaseKey: pk,
        status: (patch.status as "not_started") ?? existing?.status ?? "not_started",
        startedAt: patch.startedAt ? patch.startedAt.toISOString() : existing?.startedAt ?? null,
        completedAt: patch.completedAt ? patch.completedAt.toISOString() : existing?.completedAt ?? null,
        notes: patch.notes ?? existing?.notes ?? null,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const idx = phases.findIndex((p) => p.phaseKey === pk);
      if (idx >= 0) phases[idx] = merged;
      else phases.push(merged);
      return merged;
    },
    async upsertArtifact(_ws, input) {
      const existing = artifacts.find((a) => a.artifactKey === input.artifactKey);
      const merged: ProjectArtifactState = {
        id: existing?.id ?? "art-1",
        workspaceId: _ws,
        phaseId: existing?.phaseId ?? "phase-1",
        methodologyKey: input.methodologyKey,
        phaseKey: input.phaseKey,
        artifactKey: input.artifactKey,
        status: (input.status as "done") ?? existing?.status ?? "pending",
        mandatory: input.mandatory ?? existing?.mandatory ?? false,
        visible: input.visible ?? existing?.visible ?? true,
        filledContent: input.filledContent ?? existing?.filledContent ?? null,
        knowledgeResourceId: input.knowledgeResourceId ?? existing?.knowledgeResourceId ?? null,
        startedAt: input.startedAt ? input.startedAt.toISOString() : existing?.startedAt ?? null,
        completedAt: input.completedAt ? input.completedAt.toISOString() : existing?.completedAt ?? null,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const idx = artifacts.findIndex((a) => a.artifactKey === input.artifactKey);
      if (idx >= 0) artifacts[idx] = merged;
      else artifacts.push(merged);
      return merged;
    },
    async seedForMethodology() {},
    async getPhaseConfig() {
      return config;
    },
    async upsertPhaseConfig(_ws, input) {
      config = {
        workspaceId: _ws,
        methodologyKey: input.methodologyKey,
        currentPhaseKey: input.currentPhaseKey ?? null,
        requirePhaseStarted: input.requirePhaseStarted ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return config;
    },
  };
  return repo;
}

function makeInMemoryKnowledgeRepo(): IKnowledgeRepository {
  const categories = new Map<string, { id: string }>();
  const resources = new Map<string, { id: string; title: string; contentText: string }>();
  return {
    async listCategories() {
      return [];
    },
    async createCategory(input) {
      const cat = { id: `cat-${input.key}`, ...input } as never;
      categories.set(`${input.workspaceId}:${input.key}`, { id: cat.id });
      return cat;
    },
    async findCategoryByKey(workspaceId, key) {
      const c = categories.get(`${workspaceId}:${key}`);
      return c ? ({ id: c.id, workspaceId, key } as never) : null;
    },
    async get() {
      return null;
    },
    async list() {
      return [];
    },
    async count() {
      return 0;
    },
    async create(input) {
      const id = `res-${resources.size + 1}`;
      resources.set(id, { id, title: input.title, contentText: input.contentText });
      return { id, ...input } as never;
    },
    async update(id, patch) {
      const r = resources.get(id);
      if (r) {
        if (patch.title !== undefined) r.title = patch.title;
        if (patch.contentText !== undefined) r.contentText = patch.contentText;
      }
      return { id, ...r } as never;
    },
    async delete() {},
    async incrementView() {},
    async incrementUse() {},
    async replaceChunks() {},
    async listChunks() {
      return [];
    },
    async getChunk() {
      return null;
    },
    async listVersions() {
      return [];
    },
    async addVersion() {
      return {} as never;
    },
    async listSuggestions() {
      return [];
    },
    async addSuggestion() {
      return {} as never;
    },
    async dismissSuggestion() {},
  };
}

function makeInMemoryAuditRepo(): IAuditRepository {
  const entries: AuditEntry[] = [];
  return {
    entries,
    async record(entry) {
      entries.push(entry);
    },
  };
}

describe("SaveArtifactContent", () => {
  it("creates a KnowledgeResource and marks the artifact done", async () => {
    const phaseRepo = makeInMemoryPhaseRepo();
    const knowledgeRepo = makeInMemoryKnowledgeRepo();
    const auditRepo = makeInMemoryAuditRepo();

    const useCase = new SaveArtifactContent({
      phaseTrackingRepository: phaseRepo,
      knowledgeRepository: knowledgeRepo,
      auditRepository: auditRepo,
    });

    const result = await useCase.execute({
      workspaceId: "ws-1",
      methodologyKey: "design_thinking",
      artifactKey: "empathy_map",
      actorId: "user-1",
      input: {
        answers: {
          "¿Qué piensa y siente?": "Quiere sentirse productivo sin culpa",
          "¿Qué escucha?": "Que debería rendir más",
        },
      },
    });

    expect(result.artifact.status).toBe("done");
    expect(result.artifact.knowledgeResourceId).toBeTruthy();
    expect(result.artifact.filledContent).toContain("Mapa de Empatía");
    expect(result.artifact.filledContent).toContain("Quiere sentirse productivo sin culpa");
    expect(auditRepo.entries).toHaveLength(1);
    expect(auditRepo.entries[0].action).toBe("artifact.save_content");
  });

  it("rejects an artifact that does not belong to the methodology", async () => {
    const phaseRepo = makeInMemoryPhaseRepo();
    const knowledgeRepo = makeInMemoryKnowledgeRepo();
    const auditRepo = makeInMemoryAuditRepo();

    const useCase = new SaveArtifactContent({
      phaseTrackingRepository: phaseRepo,
      knowledgeRepository: knowledgeRepo,
      auditRepository: auditRepo,
    });

    await expect(
      useCase.execute({
        workspaceId: "ws-1",
        methodologyKey: "design_thinking",
        artifactKey: "does_not_exist",
        actorId: "user-1",
        input: { answers: {} },
      })
    ).rejects.toThrow();
  });

  it("updates the existing KnowledgeResource on a second save", async () => {
    const phaseRepo = makeInMemoryPhaseRepo();
    const knowledgeRepo = makeInMemoryKnowledgeRepo();
    const auditRepo = makeInMemoryAuditRepo();

    const useCase = new SaveArtifactContent({
      phaseTrackingRepository: phaseRepo,
      knowledgeRepository: knowledgeRepo,
      auditRepository: auditRepo,
    });

    const first = await useCase.execute({
      workspaceId: "ws-1",
      methodologyKey: "design_thinking",
      artifactKey: "csd_matrix",
      actorId: "user-1",
      input: { answers: { Certezas: "Certeza A" } },
    });
    const firstResourceId = first.knowledgeResourceId;

    const second = await useCase.execute({
      workspaceId: "ws-1",
      methodologyKey: "design_thinking",
      artifactKey: "csd_matrix",
      actorId: "user-1",
      input: { answers: { Certezas: "Certeza A actualizada" } },
    });

    expect(second.knowledgeResourceId).toBe(firstResourceId);
    expect(second.artifact.filledContent).toContain("Certeza A actualizada");
  });

  it("blocks saving an artifact when its phase is not_started and gating is on", async () => {
    const phaseRepo = makeInMemoryPhaseRepo({
      phases: [
        {
          id: "phase-1",
          workspaceId: "ws-1",
          methodologyKey: "design_thinking",
          phaseKey: "fase_1_empatizar",
          status: "not_started",
          startedAt: null,
          completedAt: null,
          notes: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      config: {
        workspaceId: "ws-1",
        methodologyKey: "design_thinking",
        currentPhaseKey: null,
        requirePhaseStarted: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    const knowledgeRepo = makeInMemoryKnowledgeRepo();
    const auditRepo = makeInMemoryAuditRepo();

    const useCase = new SaveArtifactContent({
      phaseTrackingRepository: phaseRepo,
      knowledgeRepository: knowledgeRepo,
      auditRepository: auditRepo,
    });

    await expect(
      useCase.execute({
        workspaceId: "ws-1",
        methodologyKey: "design_thinking",
        artifactKey: "empathy_map",
        actorId: "user-1",
        input: { answers: { "¿Qué ve?": "algo" } },
      })
    ).rejects.toThrow(/Inicia la fase/);
  });

  it("allows saving when gating is on but the phase is in_progress", async () => {
    const phaseRepo = makeInMemoryPhaseRepo({
      phases: [
        {
          id: "phase-1",
          workspaceId: "ws-1",
          methodologyKey: "design_thinking",
          phaseKey: "fase_1_empatizar",
          status: "in_progress",
          startedAt: new Date().toISOString(),
          completedAt: null,
          notes: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      config: {
        workspaceId: "ws-1",
        methodologyKey: "design_thinking",
        currentPhaseKey: "fase_1_empatizar",
        requirePhaseStarted: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    const knowledgeRepo = makeInMemoryKnowledgeRepo();
    const auditRepo = makeInMemoryAuditRepo();

    const useCase = new SaveArtifactContent({
      phaseTrackingRepository: phaseRepo,
      knowledgeRepository: knowledgeRepo,
      auditRepository: auditRepo,
    });

    const result = await useCase.execute({
      workspaceId: "ws-1",
      methodologyKey: "design_thinking",
      artifactKey: "empathy_map",
      actorId: "user-1",
      input: { answers: { "¿Qué ve?": "algo" } },
    });
    expect(result.artifact.status).toBe("done");
  });
});

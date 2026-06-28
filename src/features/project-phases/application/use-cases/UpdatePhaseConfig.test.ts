import { describe, expect, it } from "vitest";
import { UpdatePhaseConfig } from "./UpdatePhaseConfig";
import type { IPhaseTrackingRepository } from "../../domain/repositories";
import type { ProjectPhaseConfig } from "../../domain/entities";
import type {
  IAuditRepository,
  AuditEntry,
} from "@/features/project-settings/domain/repositories";

function makeRepo(starting?: ProjectPhaseConfig | null) {
  let config: ProjectPhaseConfig | null = starting ?? null;
  const repo: IPhaseTrackingRepository = {
    async listPhases() {
      return [];
    },
    async listArtifacts() {
      return [];
    },
    async upsertPhase() {
      throw new Error("not used");
    },
    async upsertArtifact() {
      throw new Error("not used");
    },
    async seedForMethodology() {},
    async getPhaseConfig() {
      return config;
    },
    async upsertPhaseConfig(_ws, input) {
      config = {
        workspaceId: _ws,
        methodologyKey: input.methodologyKey,
        currentPhaseKey: input.currentPhaseKey ?? config?.currentPhaseKey ?? null,
        requirePhaseStarted:
          input.requirePhaseStarted ?? config?.requirePhaseStarted ?? true,
        createdAt: config?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return config;
    },
  };
  return repo;
}

function makeAuditRepo() {
  const entries: AuditEntry[] = [];
  const repo: IAuditRepository = {
    entries,
    async record(entry: AuditEntry) {
      entries.push(entry);
    },
  };
  return repo;
}

describe("UpdatePhaseConfig", () => {
  it("rejects a currentPhaseKey that does not belong to the methodology", async () => {
    const repo = makeRepo();
    const useCase = new UpdatePhaseConfig({
      phaseTrackingRepository: repo,
      auditRepository: makeAuditRepo(),
    });
    await expect(
      useCase.execute({
        workspaceId: "ws-1",
        methodologyKey: "design_thinking",
        actorId: "u1",
        input: { currentPhaseKey: "does_not_exist" },
      })
    ).rejects.toThrow(/no pertenece a la metodología/);
  });

  it("persists requirePhaseStarted and a valid currentPhaseKey", async () => {
    const repo = makeRepo();
    const audit = makeAuditRepo();
    const useCase = new UpdatePhaseConfig({
      phaseTrackingRepository: repo,
      auditRepository: audit,
    });
    const result = await useCase.execute({
      workspaceId: "ws-1",
      methodologyKey: "design_thinking",
      actorId: "u1",
      input: { requirePhaseStarted: false, currentPhaseKey: "fase_2_definir" },
    });
    expect(result.requirePhaseStarted).toBe(false);
    expect(result.currentPhaseKey).toBe("fase_2_definir");
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0].action).toBe("phase_config.update");
  });
});

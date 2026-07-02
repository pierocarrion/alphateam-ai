import { smartGoalSchema, type SmartGoalInput } from "../schemas";
import { computeSmartScore } from "../smart";
import type { ISmartGoalRepository } from "../../domain/repositories";
import type { IAuditRepository } from "../../domain/repositories";
import type { SmartGoal } from "../../domain/entities";
import { UserFacingError } from "@/server/lib/errors";

export interface SaveSmartGoalDeps {
  smartGoalRepository: ISmartGoalRepository;
  auditRepository: IAuditRepository;
}

export interface SaveSmartGoalRequest extends SmartGoalInput {
  workspaceId: string;
  actorId: string;
}

export class SaveSmartGoal {
  constructor(private readonly deps: SaveSmartGoalDeps) {}

  async execute(request: SaveSmartGoalRequest): Promise<SmartGoal> {
    const input = smartGoalSchema.parse({
      title: request.title,
      specific: request.specific ?? null,
      measurable: request.measurable ?? null,
      achievable: request.achievable ?? null,
      relevant: request.relevant ?? null,
      timeBound: request.timeBound ?? null,
    });

    const title = input.title.trim();
    if (title.length < 2) {
      throw new UserFacingError("El objetivo necesita un título claro.", 400);
    }

    const previous = await this.deps.smartGoalRepository.get(request.workspaceId);
    const smartScore = computeSmartScore(input);

    const saved = await this.deps.smartGoalRepository.upsert({
      workspaceId: request.workspaceId,
      title,
      specific: input.specific?.trim() || null,
      measurable: input.measurable?.trim() || null,
      achievable: input.achievable?.trim() || null,
      relevant: input.relevant?.trim() || null,
      timeBound: input.timeBound?.trim() || null,
      smartScore,
      changedById: request.actorId,
    });

    await this.deps.auditRepository.record({
      workspaceId: request.workspaceId,
      actorId: request.actorId,
      action: "smart_goal.update",
      entity: "smart_goal",
      entityId: saved.id,
      before: previous ?? null,
      after: saved,
    });

    return saved;
  }
}

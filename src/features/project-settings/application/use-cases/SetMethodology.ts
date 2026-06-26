import { methodologySchema, type MethodologyInput } from "../schemas";
import { METHODOLOGIES } from "../../domain/catalog";
import type { IMethodologyRepository, IAuditRepository } from "../../domain/repositories";
import type { ProjectMethodologySelection } from "../../domain/entities";
import { UserFacingError } from "@/server/lib/errors";

export interface SetMethodologyDeps {
  methodologyRepository: IMethodologyRepository;
  auditRepository: IAuditRepository;
}

export interface SetMethodologyRequest extends MethodologyInput {
  workspaceId: string;
  actorId: string;
}

export class SetMethodology {
  constructor(private readonly deps: SetMethodologyDeps) {}

  async execute(request: SetMethodologyRequest): Promise<ProjectMethodologySelection[]> {
    const input = methodologySchema.parse({
      primary: request.primary,
      secondary: request.secondary ?? [],
    });

    if (!input.primary) {
      throw new UserFacingError("Elige una metodología principal.", 400);
    }
    const validKeys = new Set(METHODOLOGIES.map((m) => m.key));
    if (!validKeys.has(input.primary)) {
      throw new UserFacingError("La metodología principal no es válida.", 400);
    }
    const secondary = Array.from(new Set(input.secondary)).filter(
      (k) => validKeys.has(k) && k !== input.primary
    );

    const previous = await this.deps.methodologyRepository.list(request.workspaceId);

    // La metodología principal es inmutable: se define al crear el proyecto
    // y no puede reasignarse posteriormente.
    const hasPrimary = previous.some((m) => m.tier === "primary");
    const changesPrimary =
      hasPrimary &&
      (input.primary !== previous.find((m) => m.tier === "primary")?.methodologyKey);
    if (changesPrimary) {
      throw new UserFacingError(
        "La metodología principal no se puede cambiar una vez creado el proyecto.",
        409
      );
    }

    const next = await this.deps.methodologyRepository.set({
      workspaceId: request.workspaceId,
      primary: input.primary,
      secondary,
    });

    await this.deps.auditRepository.record({
      workspaceId: request.workspaceId,
      actorId: request.actorId,
      action: "methodology.update",
      entity: "methodology",
      before: previous,
      after: next,
    });

    return next;
  }
}

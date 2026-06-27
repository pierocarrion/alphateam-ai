import { getMethodologyContent } from "@/features/project-settings/domain/methodology-content";
import type { IKnowledgeRepository } from "@/features/knowledge/domain/repositories/IKnowledgeRepository";
import type { IPhaseTrackingRepository } from "../../domain/repositories";
import type { IAuditRepository } from "@/features/project-settings/domain/repositories";
import { UserFacingError } from "@/server/lib/errors";
import {
  saveArtifactContentSchema,
  type SaveArtifactContentInput,
} from "../../application/schemas";
import { getMethodologyPhases } from "../../domain/visualization";

const METHODOLOGY_CATEGORY_KEY = "methodology";

export interface SaveArtifactContentDeps {
  phaseTrackingRepository: IPhaseTrackingRepository;
  knowledgeRepository: IKnowledgeRepository;
  auditRepository: IAuditRepository;
}

export interface SaveArtifactContentRequest {
  workspaceId: string;
  methodologyKey: string;
  artifactKey: string;
  actorId: string;
  input: SaveArtifactContentInput;
}

/**
 * Guarda el contenido que el usuario llenó para un artefacto de la metodología.
 * El contenido se materializa como un KnowledgeResource (sourceType
 * "methodology_artifact") para integrarse con la base de conocimiento, el
 * buscador semántico y las sugerencias de Alpha. También marca el artefacto
 * como `done` y registra auditoría.
 */
export class SaveArtifactContent {
  constructor(private readonly deps: SaveArtifactContentDeps) {}

  async execute(request: SaveArtifactContentRequest) {
    const input = saveArtifactContentSchema.parse(request.input);

    const content = getMethodologyContent(request.methodologyKey);
    if (!content) {
      throw new UserFacingError("La metodología no tiene contenido registrado.", 400);
    }

    const phases = getMethodologyPhases(request.methodologyKey);
    const located = phases
      .flatMap((p) => p.items.map((i) => ({ phaseKey: p.phaseKey, item: i })))
      .find((x) => x.item.key === request.artifactKey);

    if (!located) {
      throw new UserFacingError("El artefacto no pertenece a la metodología.", 400);
    }

    const { item, phaseKey } = located;
    const prompts = item.prompts ?? [];

    // Construye el texto plano del artefacto a partir de las respuestas.
    const contentText = buildContentText(item.name, prompts, input.answers);

    // Asegura la categoría "methodology" (idempotente).
    let category = await this.deps.knowledgeRepository.findCategoryByKey(
      request.workspaceId,
      METHODOLOGY_CATEGORY_KEY
    );
    if (!category) {
      category = await this.deps.knowledgeRepository.createCategory({
        workspaceId: request.workspaceId,
        key: METHODOLOGY_CATEGORY_KEY,
        name: "Metodología",
        icon: "compass",
        color: "#6366f1",
      });
    }

    // Crea o actualiza el KnowledgeResource vinculado.
    const existingArtifacts = await this.deps.phaseTrackingRepository.listArtifacts(
      request.workspaceId
    );
    const existing = existingArtifacts.find((a) => a.artifactKey === request.artifactKey);

    let resourceId: string;
    if (existing?.knowledgeResourceId) {
      await this.deps.knowledgeRepository.update(existing.knowledgeResourceId, {
        title: item.name,
        contentText,
      });
      resourceId = existing.knowledgeResourceId;
    } else {
      const created = await this.deps.knowledgeRepository.create({
        workspaceId: request.workspaceId,
        categoryId: category.id,
        title: item.name,
        contentText,
        summary: `${content.name} · ${content.sections.find((s) =>
          s.items.some((i) => i.key === item.key)
        )?.title ?? ""}`,
        fileType: "text",
        sourceType: "methodology_artifact",
        sourceApp: "methodology",
        authorId: request.actorId,
        createdById: request.actorId,
        accessLevel: "workspace",
        tags: [request.methodologyKey, phaseKey, "methodology"],
        keywords: [item.key],
        aiMetadata: { methodologyKey: request.methodologyKey, phaseKey, artifactKey: item.key },
      });
      resourceId = created.id;
    }

    const now = new Date();
    const existingStarted = existing?.startedAt ? new Date(existing.startedAt) : null;
    const result = await this.deps.phaseTrackingRepository.upsertArtifact(
      request.workspaceId,
      {
        methodologyKey: request.methodologyKey,
        phaseKey,
        artifactKey: request.artifactKey,
        status: "done",
        filledContent: contentText,
        knowledgeResourceId: resourceId,
        startedAt: existingStarted ?? now,
        completedAt: now,
      }
    );

    await this.deps.auditRepository.record({
      workspaceId: request.workspaceId,
      actorId: request.actorId,
      action: "artifact.save_content",
      entity: "artifact",
      entityId: request.artifactKey,
      before: existing ? { status: existing.status } : null,
      after: { status: result.status, knowledgeResourceId: resourceId },
    });

    return { artifact: result, knowledgeResourceId: resourceId };
  }
}

function buildContentText(
  artifactName: string,
  prompts: string[],
  answers: Record<string, string>
): string {
  const lines: string[] = [`# ${artifactName}`, ""];
  if (prompts.length === 0) {
    const body = Object.values(answers).filter(Boolean).join("\n\n");
    return body ? `${lines.join("\n")}${body}` : lines.join("\n");
  }
  for (const prompt of prompts) {
    const value = answers[prompt]?.trim();
    lines.push(`## ${prompt}`);
    lines.push(value && value.length > 0 ? value : "_(sin responder)_");
    lines.push("");
  }
  return lines.join("\n");
}

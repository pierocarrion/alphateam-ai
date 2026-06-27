import { NextResponse } from "next/server";
import { requireProjectLeader } from "@/server/lib/requireProjectLeader";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { getProjectSettingsDeps } from "@/features/project-settings/infrastructure/container";
import { getProjectPhasesDeps } from "@/features/project-phases/infrastructure/container";
import { SetArtifactStatus } from "@/features/project-phases/application/use-cases/SetArtifactStatus";
import { ToggleArtifact } from "@/features/project-phases/application/use-cases/ToggleArtifact";
import { SaveArtifactContent } from "@/features/project-phases/application/use-cases/SaveArtifactContent";
import {
  saveArtifactContentSchema,
  setArtifactStatusSchema,
  toggleArtifactSchema,
} from "@/features/project-phases/application/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; artifactKey: string }> }
) {
  try {
    const { id, artifactKey } = await params;
    const auth = await requireProjectLeader(id);
    if (auth.response) return auth.response;

    const body = await parseRequestBody(request);
    const settingsDeps = getProjectSettingsDeps();
    const methodologies = await settingsDeps.methodologyRepository.list(auth.workspaceId!);
    const primary = methodologies.find((m) => m.tier === "primary");
    if (!primary) {
      return NextResponse.json({ error: "El proyecto no tiene metodología primaria." }, { status: 400 });
    }

    const deps = getProjectPhasesDeps();
    const artifactKeyDecoded = decodeURIComponent(artifactKey);

    // Dispatch según la forma del body:
    // 1) { answers } -> guarda contenido (crea KnowledgeResource, marca done)
    // 2) { status } -> cambia estado del artefacto
    // 3) { mandatory?, visible? } -> toggle flags
    if (typeof body === "object" && body !== null && "answers" in body) {
      const parsed = saveArtifactContentSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: toFriendlyMessage(parsed.error) }, { status: 400 });
      }
      const useCase = new SaveArtifactContent({
        phaseTrackingRepository: deps.phaseTrackingRepository,
        knowledgeRepository: deps.knowledgeRepository,
        auditRepository: deps.auditRepository,
      });
      const result = await useCase.execute({
        workspaceId: auth.workspaceId!,
        methodologyKey: primary.methodologyKey,
        artifactKey: artifactKeyDecoded,
        actorId: auth.user.id,
        input: parsed.data,
      });
      return NextResponse.json(result);
    }

    if (typeof body === "object" && body !== null && "status" in body) {
      const parsed = setArtifactStatusSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: toFriendlyMessage(parsed.error) }, { status: 400 });
      }
      const useCase = new SetArtifactStatus({
        phaseTrackingRepository: deps.phaseTrackingRepository,
        auditRepository: deps.auditRepository,
      });
      const result = await useCase.execute({
        workspaceId: auth.workspaceId!,
        methodologyKey: primary.methodologyKey,
        artifactKey: artifactKeyDecoded,
        actorId: auth.user.id,
        input: parsed.data,
      });
      return NextResponse.json({ artifact: result });
    }

    const parsed = toggleArtifactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: toFriendlyMessage(parsed.error) }, { status: 400 });
    }
    const useCase = new ToggleArtifact({
      phaseTrackingRepository: deps.phaseTrackingRepository,
      auditRepository: deps.auditRepository,
    });
    const result = await useCase.execute({
      workspaceId: auth.workspaceId!,
      methodologyKey: primary.methodologyKey,
      artifactKey: artifactKeyDecoded,
      actorId: auth.user.id,
      input: parsed.data,
    });
    return NextResponse.json({ artifact: result });
  } catch (error) {
    return jsonError(error);
  }
}

import { NextResponse } from "next/server";
import { requireProjectLeader } from "@/server/lib/requireProjectLeader";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { getProjectSettingsDeps } from "@/features/project-settings/infrastructure/container";
import { getProjectPhasesDeps } from "@/features/project-phases/infrastructure/container";
import { AdvancePhase } from "@/features/project-phases/application/use-cases/AdvancePhase";
import { advancePhaseSchema } from "@/features/project-phases/application/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; phaseKey: string }> }
) {
  try {
    const { id, phaseKey } = await params;
    const auth = await requireProjectLeader(id);
    if (auth.response) return auth.response;

    const parsed = advancePhaseSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: toFriendlyMessage(parsed.error) }, { status: 400 });
    }

    const settingsDeps = getProjectSettingsDeps();
    const methodologies = await settingsDeps.methodologyRepository.list(auth.workspaceId!);
    const primary = methodologies.find((m) => m.tier === "primary");
    if (!primary) {
      return NextResponse.json({ error: "El proyecto no tiene metodología primaria." }, { status: 400 });
    }

    const deps = getProjectPhasesDeps();
    const useCase = new AdvancePhase({
      phaseTrackingRepository: deps.phaseTrackingRepository,
      auditRepository: deps.auditRepository,
    });
    const result = await useCase.execute({
      workspaceId: auth.workspaceId!,
      methodologyKey: primary.methodologyKey,
      phaseKey: decodeURIComponent(phaseKey),
      actorId: auth.user.id,
      input: parsed.data,
    });
    return NextResponse.json({ phase: result });
  } catch (error) {
    return jsonError(error);
  }
}

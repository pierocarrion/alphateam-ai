import { NextResponse } from "next/server";
import { requireProjectMember } from "@/server/lib/requireProjectMember";
import { jsonError } from "@/server/lib/apiErrors";
import { getProjectSettingsDeps } from "@/features/project-settings/infrastructure/container";
import { getProjectPhasesDeps } from "@/features/project-phases/infrastructure/container";
import { GetPhaseTracking } from "@/features/project-phases/application/use-cases/GetPhaseTracking";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Read access for any workspace member (the global phase indicator is
    // visible to the whole team). Writes remain leader-only.
    const auth = await requireProjectMember(id);
    if (auth.response) return auth.response;

    const url = new URL(request.url);
    const explicit = url.searchParams.get("methodologyKey");

    const settingsDeps = getProjectSettingsDeps();
    const methodologies = await settingsDeps.methodologyRepository.list(auth.workspaceId!);
    const primary = methodologies.find((m) => m.tier === "primary");
    const methodologyKey = explicit ?? primary?.methodologyKey;

    if (!methodologyKey) {
      return NextResponse.json({ summary: null });
    }

    const deps = getProjectPhasesDeps();
    const useCase = new GetPhaseTracking({
      phaseTrackingRepository: deps.phaseTrackingRepository,
      knowledgeRepository: deps.knowledgeRepository,
    });
    const summary = await useCase.execute({
      workspaceId: auth.workspaceId!,
      methodologyKey,
    });
    return NextResponse.json({ summary });
  } catch (error) {
    return jsonError(error);
  }
}

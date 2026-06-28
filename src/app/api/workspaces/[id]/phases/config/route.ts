import { NextResponse } from "next/server";
import { requireProjectLeader } from "@/server/lib/requireProjectLeader";
import { jsonError } from "@/server/lib/apiErrors";
import { getProjectSettingsDeps } from "@/features/project-settings/infrastructure/container";
import { getProjectPhasesDeps } from "@/features/project-phases/infrastructure/container";
import { UpdatePhaseConfig } from "@/features/project-phases/application/use-cases/UpdatePhaseConfig";
import { updatePhaseConfigSchema } from "@/features/project-phases/application/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireProjectLeader(id);
    if (auth.response) return auth.response;

    const config = await getProjectPhasesDeps().phaseTrackingRepository.getPhaseConfig(
      auth.workspaceId!
    );
    return NextResponse.json({ config });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireProjectLeader(id);
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => null);
    const parsed = updatePhaseConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Revisa los campos de configuración de fases." },
        { status: 400 }
      );
    }

    const settingsDeps = getProjectSettingsDeps();
    const methodologies = await settingsDeps.methodologyRepository.list(auth.workspaceId!);
    const primary = methodologies.find((m) => m.tier === "primary");
    if (!primary) {
      return NextResponse.json(
        { error: "El proyecto no tiene metodología primaria." },
        { status: 400 }
      );
    }

    const deps = getProjectPhasesDeps();
    const useCase = new UpdatePhaseConfig({
      phaseTrackingRepository: deps.phaseTrackingRepository,
      auditRepository: deps.auditRepository,
    });
    const result = await useCase.execute({
      workspaceId: auth.workspaceId!,
      methodologyKey: primary.methodologyKey,
      actorId: auth.user.id,
      input: parsed.data,
    });
    return NextResponse.json({ config: result });
  } catch (error) {
    return jsonError(error);
  }
}

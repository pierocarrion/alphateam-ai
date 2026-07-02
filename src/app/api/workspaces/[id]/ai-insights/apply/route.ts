import { NextResponse } from "next/server";
import { requireProjectLeader } from "@/server/lib/requireProjectLeader";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { getProjectSettingsDeps } from "@/features/project-settings/infrastructure/container";
import { ApplyAiInsights } from "@/features/project-settings/application/use-cases/ApplyAiInsights";
import { applyAiInsightsSchema } from "@/features/project-settings/application/schemas";

/**
 * Ejecuta el lote de acciones propuestas por la IA. Devuelve el detalle de
 * qué se aplicó y qué no (con errores por acción) más el `before` snapshot
 * que el cliente reenvía a `/revert` para deshacer la operación.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireProjectLeader((await params).id);
    if (auth.response) return auth.response;

    const parsed = applyAiInsightsSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: toFriendlyMessage(parsed.error) }, { status: 400 });
    }

    const deps = getProjectSettingsDeps();
    const useCase = new ApplyAiInsights(deps);
    const result = await useCase.execute({
      workspaceId: auth.workspaceId!,
      actorId: auth.user.id,
      actions: parsed.data.actions,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}

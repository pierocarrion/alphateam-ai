import { NextResponse } from "next/server";
import { requireProjectLeader } from "@/server/lib/requireProjectLeader";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { getProjectSettingsDeps } from "@/features/project-settings/infrastructure/container";
import { RevertAiInsights } from "@/features/project-settings/application/use-cases/RevertAiInsights";
import { revertAiInsightsSchema } from "@/features/project-settings/application/schemas";

/**
 * Restaura el snapshot devuelto por `/apply` para deshacer los cambios
 * aplicados por la IA. Es idempotente en el sentido de que secciones vacías
 * del snapshot se omiten sin error.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireProjectLeader((await params).id);
    if (auth.response) return auth.response;

    const parsed = revertAiInsightsSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: toFriendlyMessage(parsed.error) }, { status: 400 });
    }

    const deps = getProjectSettingsDeps();
    const useCase = new RevertAiInsights(deps);
    const result = await useCase.execute({
      ...parsed.data,
      workspaceId: auth.workspaceId!,
      actorId: auth.user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}

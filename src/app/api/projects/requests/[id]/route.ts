import { NextResponse } from "next/server";
import { requireUser } from "@/server/lib/auth";
import { container } from "@/server/lib/container";
import { jsonError, parseRequestBody } from "@/server/lib/apiErrors";
import {
  DecideJoinRequest,
  decideJoinRequestSchema,
} from "@/features/projects/application/use-cases/DecideJoinRequest";

const decideJoinRequest = new DecideJoinRequest(container.projectRepository);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = (await parseRequestBody(request)) as Record<string, unknown>;
    const parsed = decideJoinRequestSchema.safeParse({
      ...body,
      requestId: id,
      decidedById: auth.user.id,
    });
    if (!parsed.success) {
      return jsonError(parsed.error);
    }

    const updated = await decideJoinRequest.execute(parsed.data);
    return NextResponse.json({ request: updated });
  } catch (error) {
    return jsonError(error);
  }
}

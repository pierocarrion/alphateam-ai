import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/lib/auth";
import { container } from "@/server/lib/container";
import { jsonError, parseRequestBody } from "@/server/lib/apiErrors";
import { RequestToJoin } from "@/features/projects/application/use-cases/RequestToJoin";

const requestToJoinSchema = z.object({
  hashtag: z.string().min(1),
  message: z.string().max(280).optional(),
});

const requestToJoin = new RequestToJoin(container.projectRepository);

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = (await parseRequestBody(request)) as Record<string, unknown>;
    const parsed = requestToJoinSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error);
    }

    const joinRequest = await requestToJoin.execute({
      userId: auth.user.id,
      hashtag: parsed.data.hashtag,
      message: parsed.data.message,
    });

    return NextResponse.json({ request: joinRequest });
  } catch (error) {
    return jsonError(error);
  }
}

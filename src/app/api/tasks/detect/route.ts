import { NextResponse } from "next/server";
import { z } from "zod";
import { deriveTaskEnhanced, looksLikeTask } from "@/features/tasks/lib/detect";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { requireUser } from "@/server/lib/auth";

const bodySchema = z.object({
  text: z.string().min(1),
  force: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const parsed = bodySchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    const text = parsed.data.text.trim();
    if (!text) {
      return NextResponse.json(
        { error: "Please add some text to look at." },
        { status: 400 }
      );
    }

    const shouldDetect = parsed.data.force || looksLikeTask(text);
    const detected = shouldDetect ? await deriveTaskEnhanced(text) : null;

    return NextResponse.json({ detected });
  } catch (error) {
    return jsonError(error);
  }
}

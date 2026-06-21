import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { deriveTaskEnhanced, looksLikeTask } from "@/features/tasks/lib/detect";
import { jsonError, parseRequestBody } from "@/server/lib/apiErrors";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Please sign in to continue." },
        { status: 401 }
      );
    }

    const body = (await parseRequestBody(request)) as { text?: string };
    const text = body.text?.trim() ?? "";

    if (!text) {
      return NextResponse.json(
        { error: "Please add some text to look at." },
        { status: 400 }
      );
    }

    const detected = looksLikeTask(text) ? await deriveTaskEnhanced(text) : null;

    return NextResponse.json({ detected });
  } catch (error) {
    return jsonError(error);
  }
}

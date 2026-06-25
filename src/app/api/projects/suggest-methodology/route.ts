import { NextResponse } from "next/server";
import { requireUser } from "@/server/lib/auth";
import { jsonError } from "@/server/lib/apiErrors";
import { suggestMethodology } from "@/server/lib/projectSettingsAi";

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = (await request.json().catch(() => null)) as {
      description?: string;
      industry?: string | null;
      category?: string | null;
    } | null;

    const description = (body?.description ?? "").toString();
    const industry = body?.industry ? String(body.industry) : null;
    const category = body?.category ? String(body.category) : null;

    const result = await suggestMethodology({ description, industry, category });
    if (!result.ok || !result.data) {
      return NextResponse.json(
        { error: result.error ?? "No pudimos sugerir una metodología." },
        { status: 422 }
      );
    }
    return NextResponse.json({ suggestion: result.data });
  } catch (error) {
    return jsonError(error);
  }
}

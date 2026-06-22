import { NextResponse } from "next/server";
import { requireUser } from "@/server/lib/auth";
import { container } from "@/server/lib/container";
import { jsonError } from "@/server/lib/apiErrors";
import {
  isValidHashtag,
  normalizeHashtag,
} from "@/features/projects/domain/hashtag";

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const raw = searchParams.get("h") ?? "";
    const hashtag = normalizeHashtag(raw);

    if (!isValidHashtag(hashtag)) {
      return NextResponse.json({
        available: false,
        valid: false,
        hashtag,
        reason:
          "Debe empezar con #, usar minúsculas y guiones (2 a 31 caracteres).",
      });
    }

    const existing = await container.projectRepository.findByHashtag(hashtag);
    return NextResponse.json({
      available: !existing,
      valid: true,
      hashtag,
    });
  } catch (error) {
    return jsonError(error);
  }
}

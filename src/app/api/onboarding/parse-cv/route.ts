import { NextResponse } from "next/server";
import { createId } from "@paralleldrive/cuid2";
import { requireUser } from "@/server/lib/auth";
import { getFileStorage } from "@/server/lib/storage";
import { jsonError } from "@/server/lib/apiErrors";
import { createLogger } from "@/shared/lib/logger";
import {
  parseCvPdfWithGemini,
  parseCvTextWithGemini,
  type ParsedCv,
} from "@/server/lib/ai/parseCv";
import { toFriendlyGeminiError } from "@/server/lib/gemini";

const log = createLogger("api:onboarding-parse-cv");

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** MIME / extension allow-list. PDF is parsed natively by Gemini; txt/md as text. */
const ACCEPTED = new Set(["pdf", "txt", "md"]);

function extOf(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Adjunta un archivo (campo 'file')." },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "El archivo está vacío." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "El CV supera los 5 MB." },
        { status: 413 }
      );
    }

    const ext = extOf(file.name);
    if (!ACCEPTED.has(ext)) {
      return NextResponse.json(
        {
          error:
            "Formato no soportado. Sube tu CV en PDF, TXT o MD (si tienes un .docx, expórtalo a PDF).",
        },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^\w.-]/g, "_");
    const storageKey = `cv/${auth.user.id}/${createId()}-${safeName}`;

    const storage = getFileStorage();
    await storage.put(storageKey, buffer, file.type || "application/octet-stream");

    // Parse: PDF goes straight to Gemini as inline data; txt/md as text.
    const result =
      ext === "pdf"
        ? await parseCvPdfWithGemini(buffer)
        : await parseCvTextWithGemini(buffer.toString("utf8"));

    if (!result.ok || !result.data) {
      log.warn("cv parse failed", { error: result.error, model: result.model });
      // The file was stored, but we couldn't read it. Stay non-blocking: tell
      // the client to fall back to manual selection.
      return NextResponse.json(
        {
          storageKey,
          parsed: null,
          message:
            toFriendlyGeminiError(result.error) ??
            "No pudimos leer tu CV. Puedes continuar eligiendo manualmente.",
        },
        { status: 200 }
      );
    }

    const parsed: ParsedCv = result.data;
    return NextResponse.json({ storageKey, fileName: file.name, parsed });
  } catch (error) {
    return jsonError(error);
  }
}

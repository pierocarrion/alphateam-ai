import { NextResponse } from "next/server";
import { requireUser } from "@/server/lib/auth";
import { container } from "@/server/lib/container";
import { jsonError } from "@/server/lib/apiErrors";
import { knowledgeContainer } from "@/features/knowledge/infrastructure/knowledgeContainer";
import { detectFileType } from "@/features/knowledge/infrastructure/extractors/textExtraction";
import { analyzeImageWithGemini, toFriendlyGeminiError } from "@/server/lib/gemini";
import { createLogger } from "@/shared/lib/logger";
import { randomUUID } from "node:crypto";

const log = createLogger("api:knowledge-hub-analyze-image");

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Stage 1 of the multimodal ingest flow: the leader picks an image, we upload
 * it to Cloud Storage, run it through Gemini Vision and return rich metadata +
 * a preview so the edit form can be auto-completed BEFORE the resource is
 * persisted. Saving happens later (POST /knowledge-hub) once the user reviews.
 *
 * This route never blocks on AI failure: if Gemini is unavailable it returns
 * HTTP 200 with `warning` set, and the client falls back to manual entry.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const { id } = await params;
    const isLeader = await container.projectRepository.isLeader(auth.user.id, id);
    if (!isLeader) {
      return NextResponse.json(
        { error: "Solo el líder puede subir recursos." },
        { status: 403 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Adjunta una imagen (campo 'file')." }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "El archivo está vacío." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "La imagen supera los 15 MB." }, { status: 413 });
    }

    const mimeType = (file.type || "image/jpeg").toLowerCase();
    const fileType = detectFileType(file.name, file.type);
    if (fileType !== "image") {
      return NextResponse.json(
        { error: "Este endpoint solo procesa imágenes." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 1) Upload to Cloud Storage (staged). The returned storageKey is handed
    //    back to the client and reused when the resource is finally saved, so
    //    we never store the same bytes twice.
    const storageKey = `${id}/${randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const storage = knowledgeContainer.storage();
    await storage.put(storageKey, buffer, file.type || "image/jpeg");

    // 2) Build a data URL so the client can render the thumbnail instantly,
    //    regardless of whether the storage backend is local or GCS.
    const previewUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

    // 3) Run Gemini Vision. On any failure we respond 200 with a friendly
    //    warning and let the user fill the form by hand.
    const analysis = await analyzeImageWithGemini({ image: buffer, mimeType });

    let metadata = analysis.data ?? null;
    let warning: string | null = null;
    if (!analysis.ok || !metadata) {
      log.warn("image analysis failed, falling back to manual entry", {
        error: analysis.error,
      });
      warning = toFriendlyGeminiError(analysis.error);
      metadata = null;
    }

    // 4) Best-effort category match against the workspace's existing
    //    categories so the <select> can be pre-selected automatically.
    let categoryId: string | null = null;
    if (metadata?.category) {
      const categories = await container.knowledgeRepository.listCategories(id);
      const suggestion = metadata.category.toLowerCase();
      const match =
        categories.find((c) => c.name.toLowerCase() === suggestion) ??
        categories.find((c) => c.name.toLowerCase().includes(suggestion)) ??
        categories.find((c) => suggestion.includes(c.name.toLowerCase()));
      categoryId = match?.id ?? null;
    }

    return NextResponse.json({
      storageKey,
      previewUrl,
      fileName: file.name,
      mimeType,
      fileType,
      metadata,
      categoryId,
      warning,
    });
  } catch (error) {
    return jsonError(error);
  }
}

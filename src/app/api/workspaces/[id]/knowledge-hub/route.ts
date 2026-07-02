import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/lib/auth";
import { container } from "@/server/lib/container";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { ensureDefaultCategories } from "@/features/knowledge/application/seedCategories";
import { createLogger } from "@/shared/lib/logger";

const log = createLogger("api:knowledge-hub");

const createResourceSchema = z.object({
  title: z.string().min(1).max(200),
  contentText: z.string().min(1),
  summary: z.string().max(1000).optional(),
  categoryId: z.string().optional().nullable(),
  fileType: z.string().optional(),
  storageKey: z.string().max(500).optional().nullable(),
  sourceUrl: z.string().url().max(1000).optional().nullable(),
  sourceApp: z.string().max(80).optional(),
  sourceType: z.string().max(40).optional(),
  authorId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  accessLevel: z.enum(["workspace", "leaders", "members"]).optional(),
  isPremium: z.boolean().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  keywords: z.array(z.string().max(40)).max(30).optional(),
  aiMetadata: z.record(z.string(), z.unknown()).optional(),
  ingest: z.boolean().optional(),
  enrich: z.boolean().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const { id } = await params;

    const isMember = await container.projectRepository.isMember(auth.user.id, id);
    if (!isMember) {
      return NextResponse.json({ error: "No tienes acceso a este espacio." }, { status: 403 });
    }
    await ensureDefaultCategories(id);

    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? undefined;
    const categoryId = url.searchParams.get("categoryId") ?? undefined;
    const tag = url.searchParams.get("tag") ?? undefined;
    const isPremium = url.searchParams.get("premium");
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);

    const [items, categories, total] = await Promise.all([
      container.knowledgeRepository.list({
        workspaceId: id,
        search,
        categoryId,
        tag,
        isPremium: isPremium === "true" ? true : isPremium === "false" ? false : undefined,
        limit: Math.min(limit, 100),
        offset,
      }),
      container.knowledgeRepository.listCategories(id),
      container.knowledgeRepository.count({ workspaceId: id, search, categoryId, tag }),
    ]);

    return NextResponse.json({ items, categories, total });
  } catch (error) {
    return jsonError(error);
  }
}

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
        { error: "Solo el líder del proyecto puede añadir recursos." },
        { status: 403 }
      );
    }

    const parsed = createResourceSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: toFriendlyMessage(parsed.error) }, { status: 400 });
    }
    const data = parsed.data;
    await ensureDefaultCategories(id);

    const resource = await container.knowledgeRepository.create({
      workspaceId: id,
      title: data.title,
      contentText: data.contentText,
      summary: data.summary,
      categoryId: data.categoryId ?? null,
      fileType: (data.fileType as never) ?? "text",
      storageKey: data.storageKey ?? null,
      sourceUrl: data.sourceUrl ?? null,
      sourceApp: data.sourceApp,
      sourceType: data.sourceType ?? "manual",
      authorId: data.authorId ?? null,
      projectId: data.projectId ?? null,
      accessLevel: data.accessLevel ?? "workspace",
      isPremium: data.isPremium ?? false,
      tags: data.tags ?? [],
      keywords: data.keywords ?? [],
      aiMetadata: data.aiMetadata ?? null,
      createdById: auth.user.id,
    });

    // Run RAG ingestion (chunks + embeddings + optional AI enrichment) in the
    // background so the API responds immediately. Idempotent.
    const { knowledgeContainer } = await import("@/features/knowledge/infrastructure/knowledgeContainer");
    const ingest = knowledgeContainer.ingestDocument();
    const ingestPromise = ingest
      .run({ resource, enrich: data.enrich ?? false })
      .catch((err) => log.error("ingest error", err));

    if (data.ingest ?? true) {
      await ingestPromise;
    }

    return NextResponse.json({ resource }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

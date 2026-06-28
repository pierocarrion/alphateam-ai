import { db } from "@/server/lib/db";
import {
  knowledgeResource,
  knowledgeChunk,
  knowledgeResourceVersion,
  knowledgeCategory,
  knowledgeSuggestion,
} from "@drizzle/schema";
import {
  eq,
  and,
  or,
  desc,
  asc,
  inArray,
  ilike,
  sql,
  count,
  type SQL,
} from "drizzle-orm";
import type {
  CreateCategoryInput,
  CreateResourceInput,
  IKnowledgeRepository,
  ListResourcesFilter,
  UpdateResourceInput,
} from "../../domain/repositories/IKnowledgeRepository";
import type {
  KnowledgeCategory,
  KnowledgeResource,
  KnowledgeResourceVersion,
  KnowledgeResourceWithRelations,
  KnowledgeSuggestion,
} from "../../domain/entities/KnowledgeResource";

/**
 * Common Spanish + English stopwords excluded from search tokenization so
 * they don't dilute the FTS/ILIKE query. Words shorter than 3 chars are also
 * dropped. This is intentionally lightweight (no external dependency) — the
 * 'simple' Postgres dictionary used by the searchVector column doesn't ship
 * with a stopword list.
 */
const SEARCH_STOPWORDS = new Set([
  // Spanish
  "que", "se", "de", "del", "el", "la", "los", "las", "un", "una", "unos",
  "unas", "y", "o", "u", "a", "en", "es", "por", "con", "para", "su", "al",
  "lo", "le", "les", "mi", "tu", "sus", "este", "esta", "esto", "estos",
  "estas", "ese", "esa", "eso", "como", "mas", "más", "muy", "ya", "si",
  "sin", "sobre", "entre", "hasta", "desde", "durante", "pero", "porque",
  // English
  "the", "an", "is", "are", "was", "were", "will", "would", "can", "could",
  "should", "do", "does", "did", "in", "on", "at", "by", "for", "of", "to",
  "and", "or", "not", "no", "what", "how", "when", "where", "why", "who",
  "this", "that", "its", "our", "your", "their", "has", "have", "had",
  "been", "be", "am", "being",
]);

/**
 * Tokenizes a free-text query into meaningful search terms: lowercases,
 * splits on non-word characters, drops stopwords and very short fragments.
 * Returns [] when nothing meaningful remains (caller falls back to full-phrase
 * search in that case).
 */
function tokenizeForSearch(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9áéíóúñü]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !SEARCH_STOPWORDS.has(w));
}

function toCategory(row: {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}): KnowledgeCategory {
  return { ...row };
}

function toResource(row: {
  id: string;
  workspaceId: string;
  categoryId: string | null;
  title: string;
  summary: string | null;
  contentText: string;
  fileType: string;
  storageKey: string | null;
  sourceUrl: string | null;
  sourceApp: string | null;
  sourceType: string;
  authorId: string | null;
  projectId: string | null;
  accessLevel: string;
  isPremium: boolean;
  tags: string[];
  keywords: string[];
  status: string;
  viewCount: number;
  useCount: number;
  aiMetadata: unknown;
  version: number;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}): KnowledgeResource {
  return {
    ...row,
    fileType: row.fileType as KnowledgeResource["fileType"],
    accessLevel: row.accessLevel as KnowledgeResource["accessLevel"],
    status: row.status as KnowledgeResource["status"],
    aiMetadata: (row.aiMetadata as Record<string, unknown> | null) ?? null,
  };
}

export class PrismaKnowledgeRepository implements IKnowledgeRepository {
  async listCategories(workspaceId: string): Promise<KnowledgeCategory[]> {
    const rows = await db.query.knowledgeCategory.findMany({
      where: eq(knowledgeCategory.workspaceId, workspaceId),
      orderBy: [desc(knowledgeCategory.isDefault), asc(knowledgeCategory.name)],
    });
    return rows.map(toCategory);
  }

  async createCategory(input: CreateCategoryInput): Promise<KnowledgeCategory> {
    const [row] = await db.insert(knowledgeCategory).values(input).returning();
    return toCategory(row!);
  }

  async findCategoryByKey(workspaceId: string, key: string): Promise<KnowledgeCategory | null> {
    const row = await db.query.knowledgeCategory.findFirst({
      where: and(
        eq(knowledgeCategory.workspaceId, workspaceId),
        eq(knowledgeCategory.key, key),
      ),
    });
    return row ? toCategory(row) : null;
  }

  async get(id: string): Promise<KnowledgeResourceWithRelations | null> {
    const row = await db.query.knowledgeResource.findFirst({
      where: eq(knowledgeResource.id, id),
    });
    if (!row) return null;
    const [category, countRows] = await Promise.all([
      row.categoryId
        ? db.query.knowledgeCategory.findFirst({
            where: eq(knowledgeCategory.id, row.categoryId),
          })
        : Promise.resolve(null),
      db
        .select({ c: count() })
        .from(knowledgeChunk)
        .where(eq(knowledgeChunk.resourceId, id)),
    ]);
    return {
      ...toResource(row),
      category: category ? toCategory(category) : null,
      _chunkCount: countRows[0]?.c,
    };
  }

  private buildWhere(filter: ListResourcesFilter): SQL | undefined {
    const conditions: SQL[] = [
      eq(knowledgeResource.workspaceId, filter.workspaceId),
      eq(knowledgeResource.status, "active"),
    ];
    if (filter.categoryId)
      conditions.push(eq(knowledgeResource.categoryId, filter.categoryId));
    if (filter.tag)
      conditions.push(
        sql`${knowledgeResource.tags} @> ARRAY[${filter.tag}]::text[]`
      );
    if (typeof filter.isPremium === "boolean")
      conditions.push(eq(knowledgeResource.isPremium, filter.isPremium));
    if (filter.fileType)
      conditions.push(eq(knowledgeResource.fileType, filter.fileType));
    if (filter.search) {
      const q = filter.search.trim();
      if (q) {
        // Tokenize the query into meaningful words (drops stopwords + short
        // tokens). When we have meaningful tokens, build an OR-based FTS query
        // (word1 | word2 | …) instead of plainto_tsquery's default AND (word1
        // & word2 & …). The AND variant fails when the user's question
        // contains words not present in the resource (e.g. "qué", "se") — a
        // very common case with natural-language @Alpha questions like
        // "¿qué tecnología se usará?". OR-based matching catches any resource
        // that mentions at least one query term, and the reciprocal-rank
        // fusion in SearchKnowledge.hybrid handles ranking.
        //
        // We also add per-token ILIKE on the title as a recall backstop for
        // typos / plurals the FTS lexemes might miss (e.g. "tecnologia" vs
        // "tecnologias" — ILIKE %tecnologia% matches both).
        const tokens = tokenizeForSearch(q);
        if (tokens.length > 0) {
          // Sanitize tokens for to_tsquery: strip characters that would be
          // interpreted as operators (& | ! : ( ) < > ' ").
          const safeTokens = tokens
            .map((t) => t.replace(/[&|!():<>'"\\]/g, ""))
            .filter(Boolean);
          const tsqueryStr = safeTokens.join(" | ");
          const ilikeConditions = tokens.map((t) =>
            ilike(knowledgeResource.title, `%${t}%`)
          );
          const tagConditions = safeTokens.map((t) =>
            sql`${knowledgeResource.tags} @> ARRAY[${t}]::text[]`
          );
          conditions.push(
            or(
              tsqueryStr
                ? sql`"searchVector" @@ to_tsquery('simple', ${tsqueryStr})`
                : sql`false`,
              ...ilikeConditions,
              ...tagConditions,
              sql`${knowledgeResource.keywords} @> ARRAY[${q}]::text[]`
            )!
          );
        } else {
          // No meaningful tokens (e.g. query was all stopwords) — fall back
          // to the original full-phrase search so single-word / short queries
          // still work.
          conditions.push(
            or(
              sql`"searchVector" @@ plainto_tsquery('simple', ${q})`,
              ilike(knowledgeResource.title, `%${q}%`),
              sql`${knowledgeResource.tags} @> ARRAY[${q}]::text[]`,
              sql`${knowledgeResource.keywords} @> ARRAY[${q}]::text[]`
            )!
          );
        }
      }
    }
    return and(...conditions);
  }

  async list(filter: ListResourcesFilter): Promise<KnowledgeResourceWithRelations[]> {
    const rows = await db.query.knowledgeResource.findMany({
      where: this.buildWhere(filter),
      orderBy: desc(knowledgeResource.updatedAt),
      limit: filter.limit ?? 50,
      offset: filter.offset ?? 0,
    });
    const categoryIds = [
      ...new Set(
        rows
          .map((r) => r.categoryId)
          .filter((v): v is string => v !== null)
      ),
    ];
    const categories = categoryIds.length
      ? await db.query.knowledgeCategory.findMany({
          where: inArray(knowledgeCategory.id, categoryIds),
        })
      : [];
    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const countRows = await Promise.all(
      rows.map((r) =>
        db
          .select({ c: count() })
          .from(knowledgeChunk)
          .where(eq(knowledgeChunk.resourceId, r.id))
          .then((res) => [r.id, (res[0]?.c ?? 0)] as const)
      )
    );
    const countMap = new Map(countRows);
    return rows.map((row) => {
      const category =
        row.categoryId && categoryMap.has(row.categoryId)
          ? toCategory(categoryMap.get(row.categoryId)!)
          : null;
      return {
        ...toResource(row),
        category,
        _chunkCount: countMap.get(row.id),
      };
    });
  }

  async count(filter: ListResourcesFilter): Promise<number> {
    const rows = await db
      .select({ c: count() })
      .from(knowledgeResource)
      .where(this.buildWhere(filter));
    return rows[0]?.c ?? 0;
  }

  async create(input: CreateResourceInput): Promise<KnowledgeResource> {
    const [row] = await db
      .insert(knowledgeResource)
      .values({
        workspaceId: input.workspaceId,
        categoryId: input.categoryId ?? null,
        title: input.title,
        summary: input.summary ?? null,
        contentText: input.contentText,
        fileType: input.fileType ?? "text",
        storageKey: input.storageKey ?? null,
        sourceUrl: input.sourceUrl ?? null,
        sourceApp: input.sourceApp ?? null,
        sourceType: input.sourceType ?? "manual",
        authorId: input.authorId ?? null,
        projectId: input.projectId ?? null,
        accessLevel: input.accessLevel ?? "workspace",
        isPremium: input.isPremium ?? false,
        tags: input.tags ?? [],
        keywords: input.keywords ?? [],
        aiMetadata: (input.aiMetadata as unknown) ?? null,
        createdById: input.createdById ?? null,
      })
      .returning();
    return toResource(row!);
  }

  async update(id: string, patch: UpdateResourceInput): Promise<KnowledgeResource> {
    const data: Partial<typeof knowledgeResource.$inferInsert> = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.summary !== undefined) data.summary = patch.summary;
    if (patch.contentText !== undefined) data.contentText = patch.contentText;
    if (patch.accessLevel !== undefined) data.accessLevel = patch.accessLevel;
    if (patch.isPremium !== undefined) data.isPremium = patch.isPremium;
    if (patch.tags !== undefined) data.tags = patch.tags;
    if (patch.keywords !== undefined) data.keywords = patch.keywords;
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.aiMetadata !== undefined)
      data.aiMetadata = patch.aiMetadata as unknown;
    if (patch.categoryId !== undefined) data.categoryId = patch.categoryId;
    const [row] = await db
      .update(knowledgeResource)
      .set(data)
      .where(eq(knowledgeResource.id, id))
      .returning();
    return toResource(row!);
  }

  async delete(id: string): Promise<void> {
    await db.delete(knowledgeResource).where(eq(knowledgeResource.id, id));
  }

  async incrementView(id: string): Promise<void> {
    await db
      .update(knowledgeResource)
      .set({ viewCount: sql`${knowledgeResource.viewCount} + 1` })
      .where(eq(knowledgeResource.id, id));
  }

  async incrementUse(id: string): Promise<void> {
    await db
      .update(knowledgeResource)
      .set({ useCount: sql`${knowledgeResource.useCount} + 1` })
      .where(eq(knowledgeResource.id, id));
  }

  async replaceChunks(
    resourceId: string,
    chunks: { text: string; tokenCount?: number }[]
  ): Promise<{ id: string; ordinal: number; text: string; tokenCount: number | null }[]> {
    if (chunks.length === 0) {
      await db.delete(knowledgeChunk).where(eq(knowledgeChunk.resourceId, resourceId));
      return [];
    }
    // Delete + insert in a transaction so a concurrent reader never sees an
    // empty window. Return the inserted rows (with their cuid ids) so callers
    // (IngestDocument) can upsert embeddings keyed by the real chunk id.
    return await db.transaction(async (tx) => {
      await tx.delete(knowledgeChunk).where(eq(knowledgeChunk.resourceId, resourceId));
      const inserted = await tx
        .insert(knowledgeChunk)
        .values(
          chunks.map((chunk, idx) => ({
            resourceId,
            ordinal: idx,
            text: chunk.text,
            tokenCount: chunk.tokenCount ?? null,
          }))
        )
        .returning({
          id: knowledgeChunk.id,
          ordinal: knowledgeChunk.ordinal,
          text: knowledgeChunk.text,
          tokenCount: knowledgeChunk.tokenCount,
        });
      return inserted;
    });
  }

  async listChunks(resourceId: string) {
    return db.query.knowledgeChunk.findMany({
      where: eq(knowledgeChunk.resourceId, resourceId),
      orderBy: asc(knowledgeChunk.ordinal),
      columns: { id: true, ordinal: true, text: true, tokenCount: true },
    });
  }

  async getChunk(chunkId: string) {
    const row = await db.query.knowledgeChunk.findFirst({
      where: eq(knowledgeChunk.id, chunkId),
      columns: { id: true, resourceId: true, ordinal: true, text: true },
    });
    return row ?? null;
  }

  async listVersions(resourceId: string): Promise<KnowledgeResourceVersion[]> {
    return db.query.knowledgeResourceVersion.findMany({
      where: eq(knowledgeResourceVersion.resourceId, resourceId),
      orderBy: desc(knowledgeResourceVersion.version),
    });
  }

  async addVersion(input: Omit<KnowledgeResourceVersion, "id" | "createdAt">): Promise<KnowledgeResourceVersion> {
    const [row] = await db
      .insert(knowledgeResourceVersion)
      .values(input as unknown as typeof knowledgeResourceVersion.$inferInsert)
      .returning();
    return row!;
  }

  async listSuggestions(workspaceId: string, targetUserId?: string): Promise<KnowledgeSuggestion[]> {
    return db.query.knowledgeSuggestion.findMany({
      where: and(
        eq(knowledgeSuggestion.workspaceId, workspaceId),
        eq(knowledgeSuggestion.dismissed, false),
        ...(targetUserId
          ? [eq(knowledgeSuggestion.targetUserId, targetUserId)]
          : [])
      ),
      orderBy: desc(knowledgeSuggestion.createdAt),
      limit: 20,
    });
  }

  async addSuggestion(input: {
    workspaceId: string;
    resourceId?: string | null;
    targetUserId?: string | null;
    reason: string;
    kind?: string;
  }): Promise<KnowledgeSuggestion> {
    const [row] = await db
      .insert(knowledgeSuggestion)
      .values({
        workspaceId: input.workspaceId,
        resourceId: input.resourceId ?? null,
        targetUserId: input.targetUserId ?? null,
        reason: input.reason,
        kind: input.kind ?? "topic_match",
      })
      .returning();
    return row!;
  }

  async dismissSuggestion(id: string): Promise<void> {
    await db
      .update(knowledgeSuggestion)
      .set({ dismissed: true })
      .where(eq(knowledgeSuggestion.id, id));
  }
}

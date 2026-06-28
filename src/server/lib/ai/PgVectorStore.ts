import { db } from "@/server/lib/db";
import { knowledgeChunk, knowledgeResource } from "@drizzle/schema";
import { eq, and, isNotNull, sql, asc, count, inArray } from "drizzle-orm";
import type {
  IVectorStore,
  VectorQueryResult,
  VectorRecord,
} from "./vectorStore";
import { createLogger } from "@/shared/lib/logger";

const log = createLogger("PgVectorStore");

/**
 * Serializes a JS number[] to a Postgres vector literal "[1,2,3]". Used in raw
 * SQL because the pg driver can't bind a JS array directly to a `vector`
 * column — passing the literal string with an explicit `::vector` cast works
 * regardless of the column dimensionality.
 */
function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}

/**
 * Persistent vector store backed by the `embedding vector(768)` column on
 * `KnowledgeChunk` (Cloud SQL + pgvector). Vectors live alongside the chunk
 * text rows so the RAG pipeline gains durability, multi-instance consistency,
 * and scale-to-zero safety that the previous in-memory store lacked.
 *
 * Chunks themselves are authored by `PrismaKnowledgeRepository.replaceChunks`;
 * this store only owns the `embedding` column on those rows (UPDATE in place).
 * Search orders by cosine distance (`<=>`) and joins `KnowledgeResource` to
 * apply the workspaceId filter that the IVectorStore contract requires.
 */
export class PgVectorStore implements IVectorStore {
  readonly kind = "pgvector";

  async upsert(records: VectorRecord[]): Promise<void> {
    if (records.length === 0) return;
    // Single round-trip batched UPDATE via a VALUES table joined on chunk id.
    // Each pair is bound as a parameter (string for vector cast, text for id)
    // so no user-provided data is interpolated into the SQL string.
    const pairs = records.map((r) =>
      sql`( ${r.id}::text, ${toPgVector(r.vector)}::vector )`
    );
    await db.execute(
      sql`
        UPDATE "KnowledgeChunk" AS kc
        SET embedding = v.embedding
        FROM (VALUES ${sql.join(pairs, sql`, `)}) AS v(id, embedding)
        WHERE kc.id = v.id
      `
    );
  }

  async query(
    vector: number[],
    opts: { topK: number; filter?: Record<string, unknown> }
  ): Promise<VectorQueryResult[]> {
    const q = toPgVector(vector);
    const workspaceId = opts.filter?.workspaceId as string | undefined;
    const resourceId = opts.filter?.resourceId as string | undefined;

    const conditions = [isNotNull(knowledgeChunk.embedding)];
    if (workspaceId) {
      conditions.push(eq(knowledgeResource.workspaceId, workspaceId));
    }
    if (resourceId) {
      conditions.push(eq(knowledgeChunk.resourceId, resourceId));
    }

    const rows = await db
      .select({
        id: knowledgeChunk.id,
        score: sql<number>`1 - (${knowledgeChunk.embedding} <=> ${q}::vector)`,
        resourceId: knowledgeChunk.resourceId,
        chunkId: knowledgeChunk.id,
        ordinal: knowledgeChunk.ordinal,
      })
      .from(knowledgeChunk)
      .innerJoin(
        knowledgeResource,
        eq(knowledgeResource.id, knowledgeChunk.resourceId)
      )
      .where(and(...conditions))
      .orderBy(asc(sql`${knowledgeChunk.embedding} <=> ${q}::vector`))
      .limit(opts.topK);

    return rows.map((r) => ({
      id: r.id,
      score: Number(r.score),
      metadata: {
        resourceId: r.resourceId,
        chunkId: r.chunkId,
        ordinal: r.ordinal,
      },
    }));
  }

  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    // Set embedding NULL instead of deleting the chunk row (the chunk text is
    // still owned by `replaceChunks`). Avoids orphaning resourceId references.
    await db
      .update(knowledgeChunk)
      .set({ embedding: null })
      .where(inArray(knowledgeChunk.id, ids));
  }

  async deleteByMetadata(filter: Record<string, unknown>): Promise<void> {
    const resourceId = filter.resourceId as string | undefined;
    const workspaceId = filter.workspaceId as string | undefined;
    if (resourceId) {
      await db
        .update(knowledgeChunk)
        .set({ embedding: null })
        .where(eq(knowledgeChunk.resourceId, resourceId));
      return;
    }
    if (workspaceId) {
      // Clear embeddings for any chunk whose resource belongs to this workspace.
      await db.execute(
        sql`UPDATE "KnowledgeChunk"
            SET embedding = NULL
            WHERE "resourceId" IN (
              SELECT id FROM "KnowledgeResource" WHERE "workspaceId" = ${workspaceId}
            )`
      );
      return;
    }
    log.warn("deleteByMetadata called without resourceId or workspaceId", filter);
  }

  async count(filter?: Record<string, unknown>): Promise<number> {
    if (!filter) {
      const rows = await db
        .select({ c: count() })
        .from(knowledgeChunk)
        .where(isNotNull(knowledgeChunk.embedding));
      return Number(rows[0]?.c ?? 0);
    }
    const workspaceId = filter.workspaceId as string | undefined;
    if (workspaceId) {
      const rows = await db
        .select({ c: count() })
        .from(knowledgeChunk)
        .innerJoin(
          knowledgeResource,
          eq(knowledgeResource.id, knowledgeChunk.resourceId)
        )
        .where(
          and(
            isNotNull(knowledgeChunk.embedding),
            eq(knowledgeResource.workspaceId, workspaceId)
          )
        );
      return Number(rows[0]?.c ?? 0);
    }
    return 0;
  }

  async clear(): Promise<void> {
    await db.update(knowledgeChunk).set({ embedding: null });
  }
}
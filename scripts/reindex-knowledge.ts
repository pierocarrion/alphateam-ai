/**
 * Reindex existing Knowledge Hub resources through IngestDocument (chunk +
 * pgvector embeddings). Run once after deploying the PgVectorStore change so
 * resources created before the persistent store existed become searchable.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/reindex-knowledge.ts
 *
 * Idempotent: re-running replaces the chunks + embeddings for every active
 * resource. Set REINDEX_ENRICH=true to also regenerate AI summaries (slow).
 * Set REINDEX_LIMIT=<n> to cap the number of resources processed.
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, asc } from "drizzle-orm";
import * as schema from "@drizzle/schema";
import type { KnowledgeResource, KnowledgeFileType, KnowledgeAccessLevel } from "@/features/knowledge/domain/entities/KnowledgeResource";
import { knowledgeContainer } from "@/features/knowledge/infrastructure/knowledgeContainer";
import { createLogger } from "@/shared/lib/logger";
import type { Db } from "@/server/lib/db";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const db: Db = drizzle(pool, { schema });

/**
 * Casts a raw DB row to a KnowledgeResource so IngestDocument accepts it.
 * Drizzle returns generic `string` for text enums; the domain narrows them
 * via union types. The cast is safe because the schema validates those values
 * at insert time.
 */
function toResource(row: typeof schema.knowledgeResource.$inferSelect): KnowledgeResource {
  return {
    ...row,
    fileType: row.fileType as KnowledgeFileType,
    accessLevel: row.accessLevel as KnowledgeAccessLevel,
    status: row.status as KnowledgeResource["status"],
    aiMetadata: (row.aiMetadata as Record<string, unknown> | null) ?? null,
  };
}

const enrich = process.env.REINDEX_ENRICH === "true";
const limit = Number.parseInt(process.env.REINDEX_LIMIT ?? "", 10) || undefined;
const log = createLogger("reindex");

async function main() {
  const query = db
    .select()
    .from(schema.knowledgeResource)
    .where(eq(schema.knowledgeResource.status, "active"))
    .orderBy(asc(schema.knowledgeResource.createdAt));
  const resources = limit ? await query.limit(limit) : await query;
  log.info(`reindexing ${resources.length} active KnowledgeResource(s)`, { enrich, limit });

  const ingest = knowledgeContainer.ingestDocument();
  let ok = 0;
  let failed = 0;
  let totalChunks = 0;
  let totalVectors = 0;
  for (let i = 0; i < resources.length; i++) {
    const resource = toResource(resources[i]!);
    try {
      const result = await ingest.run({ resource, enrich });
      ok++;
      totalChunks += result.chunks;
      totalVectors += result.vectors;
      if ((i + 1) % 10 === 0 || i === resources.length - 1) {
        log.info(`progress ${i + 1}/${resources.length}`, { ok, failed, lastTitle: resource.title });
      }
    } catch (err) {
      failed++;
      log.error("ingest failed", { id: resource.id, title: resource.title, err });
    }
  }

  log.info("done", { ok, failed, totalChunks, totalVectors });
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
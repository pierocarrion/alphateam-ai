import type { IKnowledgeRepository } from "../../domain/repositories/IKnowledgeRepository";
import type { KnowledgeResource } from "../../domain/entities/KnowledgeResource";
import { chunkText } from "../lib/chunking";
import { getVectorStore } from "@/server/lib/ai/vectorStore";
import type { AiClient } from "@/server/lib/ai/client";

export interface IngestDocumentInput {
  resource: KnowledgeResource;
  /** When true, regenerates the AI summary + keywords (slow path). */
  enrich?: boolean;
}

export interface IngestDocumentResult {
  resourceId: string;
  chunks: number;
  vectors: number;
  enriched: boolean;
}

/**
 * Use case: ingests a KnowledgeResource into the RAG pipeline.
 *  1. (optional) enrich — AI summary, keywords, metadata
 *  2. chunk the content text
 *  3. embed the chunks via the active embedder
 *  4. upsert vectors into the store, keyed by chunkId (metadata: resourceId/workspaceId)
 *  5. persist chunk text in the repository
 *
 * Idempotent: re-running replaces chunks + vectors for the resource.
 */
export class IngestDocument {
  constructor(
    private readonly repo: IKnowledgeRepository,
    private readonly ai: AiClient
  ) {}

  async run(input: IngestDocumentInput): Promise<IngestDocumentResult> {
    const { resource } = input;

    let enriched = false;
    if (input.enrich) {
      const ok = await this.enrichResource(resource);
      enriched = ok;
    }

    const chunks = chunkText(resource.contentText);
    if (chunks.length === 0) {
      await this.repo.replaceChunks(resource.id, []);
      await getVectorStore().deleteByMetadata({ resourceId: resource.id });
      return { resourceId: resource.id, chunks: 0, vectors: 0, enriched };
    }

    // Persist chunk text FIRST so each chunk has a real row id. The vector
    // store upserts reference those ids directly (PgVectorStore writes the
    // embedding column on the matching KnowledgeChunk row); using the DB id
    // instead of a synthesized `${resourceId}:${ordinal}` keeps the link
    // durable across renames/edits and lets PgVectorStore UPDATE in place.
    const persistedChunks = await this.repo.replaceChunks(
      resource.id,
      chunks.map((c) => ({ text: c.text, tokenCount: c.tokenCount }))
    );

    // Embed in batches and upsert into the vector store, keyed by real chunk id.
    const store = getVectorStore();
    const batchSize = 16;
    let upserted = 0;
    for (let i = 0; i < persistedChunks.length; i += batchSize) {
      const batch = persistedChunks.slice(i, i + batchSize);
      const embedResult = await this.ai.embedder.embed(batch.map((c) => c.text));
      if (!embedResult.ok || !embedResult.data) break;
      const records = batch.map((chunk, idx) => ({
        id: chunk.id,
        vector: embedResult.data![idx],
        metadata: {
          resourceId: resource.id,
          workspaceId: resource.workspaceId,
          chunkId: chunk.id,
          ordinal: chunk.ordinal,
        },
      }));
      await store.upsert(records);
      upserted += records.length;
    }

    return { resourceId: resource.id, chunks: persistedChunks.length, vectors: upserted, enriched };
  }

  private async enrichResource(resource: KnowledgeResource): Promise<boolean> {
    if (!this.ai.provider.isEnabled()) return false;
    const result = await this.ai.provider.chatJSON<{
      summary: string;
      keywords: string[];
      topics: string[];
      language: string;
      readingMinutes: number;
    }>({
      system:
        "You analyze a corporate knowledge document and return structured metadata as JSON.",
      messages: [
        {
          role: "user",
          content: `Title: ${resource.title}\n\nContent:\n${resource.contentText.slice(0, 4000)}\n\nReturn JSON: { "summary": "2-3 sentence summary", "keywords": ["max","8","tags"], "topics": ["3-5","topics"], "language": "en|es|...", "readingMinutes": number }`,
        },
      ],
      maxTokens: 400,
      temperature: 0.2,
    });
    if (!result.ok || !result.data) return false;
    await this.repo.update(resource.id, {
      summary: result.data.summary,
      keywords: result.data.keywords,
      aiMetadata: {
        ...(resource.aiMetadata ?? {}),
        topics: result.data.topics,
        language: result.data.language,
        readingMinutes: result.data.readingMinutes,
        enrichedBy: result.provider,
      },
    });
    return true;
  }
}

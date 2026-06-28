import type { AiResult } from "./types";
import { PgVectorStore } from "./PgVectorStore";

/**
 * Vector store abstraction for RAG retrieval. Implementations:
 *  - {@link InMemoryVectorStore}: dev/PgLite fallback (no pgvector available)
 *  - PgVectorStore (production, added in the Knowledge Hub slice)
 *
 * Dependency Inversion: the retrieval pipeline depends on this interface,
 * never on a concrete store.
 */
export interface VectorRecord {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
}

export interface VectorQueryResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface IVectorStore {
  readonly kind: string;
  upsert(records: VectorRecord[]): Promise<void>;
  query(vector: number[], opts: { topK: number; filter?: Record<string, unknown> }): Promise<VectorQueryResult[]>;
  delete(ids: string[]): Promise<void>;
  /** Scoped delete by metadata equality (e.g. all vectors for a document). */
  deleteByMetadata(filter: Record<string, unknown>): Promise<void>;
  count(filter?: Record<string, unknown>): Promise<number>;
  clear(): Promise<void>;
}

/** Cosine similarity between two equal-length vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function matchesMetadata(record: VectorRecord, filter: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(filter)) {
    if (record.metadata[key] !== value) return false;
  }
  return true;
}

/**
 * Process-wide in-memory vector store. Suitable for development and tests where
 * pgvector is unavailable (PgLite). Persisted only for the lifetime of the
 * process; production deployments swap in PgVectorStore via the same interface.
 */
export class InMemoryVectorStore implements IVectorStore {
  readonly kind = "in-memory";
  private readonly records = new Map<string, VectorRecord>();

  async upsert(records: VectorRecord[]): Promise<void> {
    for (const record of records) {
      this.records.set(record.id, { ...record, metadata: { ...record.metadata } });
    }
  }

  async query(vector: number[], opts: { topK: number; filter?: Record<string, unknown> }): Promise<VectorQueryResult[]> {
    const scored: VectorQueryResult[] = [];
    for (const record of this.records.values()) {
      if (opts.filter && !matchesMetadata(record, opts.filter)) continue;
      scored.push({ id: record.id, score: cosineSimilarity(vector, record.vector), metadata: record.metadata });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, opts.topK);
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) this.records.delete(id);
  }

  async deleteByMetadata(filter: Record<string, unknown>): Promise<void> {
    for (const [id, record] of this.records.entries()) {
      if (matchesMetadata(record, filter)) this.records.delete(id);
    }
  }

  async count(filter?: Record<string, unknown>): Promise<number> {
    if (!filter) return this.records.size;
    let count = 0;
    for (const record of this.records.values()) {
      if (matchesMetadata(record, filter)) count++;
    }
    return count;
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}

let defaultStore: IVectorStore | null = null;

/**
 * Resolves the active vector store.
 *
 * - In tests: `setVectorStore` injects an `InMemoryVectorStore` (see
 *   `knowledge.test.ts`); if not set explicitly, fall back to in-memory too.
 * - In production (when `PGVECTOR_ENABLED !== "false"` and `DATABASE_URL` is
 *   configured) we use {@link PgVectorStore}, backed by the `embedding
 *   vector(768)` column on `KnowledgeChunk` (Cloud SQL + pgvector). This
 *   replaces the previous in-memory store that lost all vectors on every
 *   Cloud Run cold start, which silently broke RAG retrieval for @Alpha.
 *
 * Set `PGVECTOR_ENABLED=false` to force the in-memory store (e.g. for a
 * smoke environment without pgvector installed).
 */
export function getVectorStore(): IVectorStore {
  if (defaultStore) return defaultStore;
  const usePg =
    process.env.NODE_ENV === "production" &&
    process.env.PGVECTOR_ENABLED !== "false" &&
    Boolean(process.env.DATABASE_URL);
  defaultStore = usePg ? new PgVectorStore() : new InMemoryVectorStore();
  return defaultStore;
}

/** Test-only override of the default vector store. */
export function setVectorStore(store: IVectorStore): void {
  defaultStore = store;
}

export type { AiResult };

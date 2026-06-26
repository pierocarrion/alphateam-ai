import type { IAiProvider, IAiEmbedder, AiResult } from "./types";
import { createAiProvider, createEmbedder, readProviderName } from "./factory";

/**
 * Application-wide AI client (singleton). All new features resolve AI through
 * this object so the underlying vendor can be swapped via env without touching
 * domain code (Dependency Inversion).
 *
 * Existing Alpha code (`gemini.ts`) is untouched for backward compatibility;
 * new modules (Knowledge Hub RAG, Wolf/Alpha analytical layer) use this client.
 */
export interface AiClient {
  readonly provider: IAiProvider;
  readonly embedder: IAiEmbedder;
  readonly providerName: string;
}

function buildAiClient(): AiClient {
  const providerName = readProviderName();
  return {
    provider: createAiProvider(providerName),
    embedder: createEmbedder(),
    providerName,
  };
}

let cached: AiClient | null = null;

export function getAiClient(): AiClient {
  if (!cached) cached = buildAiClient();
  return cached;
}

/** Test-only: rebuild the client (e.g. after setting env vars). */
export function __resetAiClient(): void {
  cached = null;
}

export type { AiResult };

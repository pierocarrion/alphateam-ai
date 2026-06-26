/**
 * Core types for the decoupled AI provider layer (Open/Closed principle).
 * New features (Wolf/Alpha analytical layer, Knowledge Hub RAG, recommendations)
 * depend ONLY on {@link IAiProvider}, never on a concrete vendor SDK.
 */

export type AiRole = "system" | "user" | "assistant";

export interface AiMessage {
  role: AiRole;
  content: string;
}

export interface AiChatRequest {
  messages: AiMessage[];
  /** Convenience: optional system prompt merged as the first system message. */
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** When true, providers hint the model to return strict JSON. */
  json?: boolean;
  /** Abort signal for streaming / long requests. */
  signal?: AbortSignal;
}

export interface AiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  /** Friendly, user-facing error message (never leaks internals). */
  friendlyError?: string;
  model: string;
  provider: string;
  /** Embeddings token usage when available. */
  usage?: { promptTokens?: number; completionTokens?: number };
}

export interface AiModelInfo {
  provider: string;
  model: string;
  enabled: boolean;
}

export interface AiEmbeddingConfig {
  model: string;
  dimensions?: number;
}

/**
 * Normalized, vendor-agnostic AI provider. Implementations live under
 * `providers/*` and are selected by {@link createAiProvider} via `AI_PROVIDER`.
 */
export interface IAiProvider {
  readonly name: string;
  readonly model: string;
  isEnabled(): boolean;
  chat(request: AiChatRequest): Promise<AiResult<string>>;
  chatJSON<T>(request: AiChatRequest): Promise<AiResult<T>>;
  embed(texts: string[]): Promise<AiResult<number[][]>>;
}

/** Embedding-only provider (some vendors, e.g. Anthropic, lack embeddings). */
export interface IAiEmbedder {
  readonly name: string;
  readonly model: string;
  isEnabled(): boolean;
  embed(texts: string[]): Promise<AiResult<number[][]>>;
}

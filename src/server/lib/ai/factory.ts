import type { IAiProvider, IAiEmbedder } from "./types";
import { GeminiProvider } from "./providers/GeminiProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";
import { AzureOpenAIProvider } from "./providers/AzureOpenAIProvider";
import { ClaudeProvider } from "./providers/ClaudeProvider";

export type AiProviderName = "gemini" | "openai" | "azure-openai" | "claude";

/**
 * Selects the chat/completion provider from `AI_PROVIDER`.
 *
 * CENTRALIZATION CONTRACT: Gemini (via Vertex AI) is the single canonical chat
 * provider. The other branches (openai / azure-openai / claude) are kept for
 * backward compatibility and experimental use, but every deployment should
 * default to `AI_PROVIDER="gemini"`. Unknown / empty values fall back to gemini.
 *
 * Open/Closed: adding a new vendor = new file + one branch here. Nothing else
 * in the codebase changes because every consumer depends on {@link IAiProvider}.
 */
export function createAiProvider(
  name: AiProviderName = readProviderName(),
  override?: ConstructorParameters<typeof GeminiProvider>[0]
): IAiProvider {
  switch (name) {
    case "openai":
      return new OpenAIProvider(override as ConstructorParameters<typeof OpenAIProvider>[0]);
    case "azure-openai":
      return new AzureOpenAIProvider(override as ConstructorParameters<typeof AzureOpenAIProvider>[0]);
    case "claude":
      return new ClaudeProvider(override as ConstructorParameters<typeof ClaudeProvider>[0]);
    case "gemini":
    default:
      return new GeminiProvider(override);
  }
}

/**
 * Resolves the embedder independently. Anthropic and (optionally) Azure lack
 * embeddings, so a separate `AI_EMBEDDING_PROVIDER` keeps RAG working regardless
 * of the chat vendor.
 *
 * CENTRALIZATION CONTRACT: the default embedder is `openai`, but the OpenAI
 * provider is routed through Vertex AI Model Garden (OpenAI-compatible endpoint,
 * GCP Application Default Credentials), so all embedding traffic & billing also
 * flows through the same GCP project as Gemini chat. Fallback order:
 *   requested -> openai (Model Garden) -> gemini (native text-embedding-004).
 */
export function createEmbedder(
  name?: AiProviderName,
  env: NodeJS.ProcessEnv = process.env
): IAiEmbedder {
  const requested = name ?? (env.AI_EMBEDDING_PROVIDER as AiProviderName | undefined);
  const candidates: AiProviderName[] = requested
    ? [requested, "openai", "gemini"]
    : ["openai", "gemini"];

  for (const candidate of candidates) {
    const provider = createAiProvider(candidate);
    if (provider.isEnabled()) {
      const probe = provider.embed(["__probe__"]);
      // Sync-enabled providers report isEnabled synchronously; treat as embedder.
      void probe;
      return provider;
    }
  }
  // Fall back to gemini (disabled) so callers get a clear friendlyError.
  return createAiProvider("gemini");
}

export function readProviderName(env: NodeJS.ProcessEnv = process.env): AiProviderName {
  const raw = (env.AI_PROVIDER ?? "gemini").toLowerCase();
  switch (raw) {
    case "openai":
    case "azure-openai":
    case "claude":
    case "gemini":
      return raw;
    default:
      return "gemini";
  }
}

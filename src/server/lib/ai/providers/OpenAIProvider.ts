import type { AiMessage, AiResult } from "../types";
import { BaseAiProvider } from "../baseProvider";
import { getGcpAccessToken } from "../gcpAuth";

export interface OpenAiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  embeddingModel: string;
  embeddingDimensions: number;
  enabled: boolean;
  /** Route OpenAI-compatible models through Vertex AI Model Garden (GCP ADC). */
  useVertexModelGarden: boolean;
  projectId: string;
  location: string;
}

/** Canonical OpenAI-compatible endpoint exposed by Vertex AI Model Garden. */
export function buildVertexModelGardenBaseUrl(projectId: string, location: string): string {
  return `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/endpoints/openapi`;
}

export function readOpenAiConfig(env: NodeJS.ProcessEnv = process.env): OpenAiConfig {
  const explicitBaseUrl = env.OPENAI_BASE_URL ?? "";
  const autoModelGarden = /aiplatform\.googleapis\.com/.test(explicitBaseUrl);
  const useVertexModelGarden =
    env.OPENAI_USE_VERTEX_MODEL_GARDEN === "true" || autoModelGarden;
  const projectId = env.GOOGLE_CLOUD_PROJECT_ID ?? "";
  const location = env.VERTEX_AI_LOCATION ?? "us-central1";

  if (useVertexModelGarden) {
    const baseUrl = explicitBaseUrl || buildVertexModelGardenBaseUrl(projectId, location);
    return {
      apiKey: "",
      baseUrl,
      model: env.OPENAI_MODEL ?? "gpt-4o-mini",
      embeddingModel: env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      enabled: Boolean(projectId),
      useVertexModelGarden: true,
      projectId,
      location,
    };
  }

  const apiKey = env.OPENAI_API_KEY ?? "";
  return {
    apiKey,
    baseUrl: explicitBaseUrl || "https://api.openai.com/v1",
    model: env.OPENAI_MODEL ?? "gpt-4o-mini",
    embeddingModel: env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    embeddingDimensions: Number(env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
    enabled: Boolean(apiKey),
    useVertexModelGarden: false,
    projectId,
    location,
  };
}

export class OpenAIProvider extends BaseAiProvider {
  readonly name = "openai";
  readonly model: string;
  private readonly config: OpenAiConfig;

  constructor(config?: Partial<OpenAiConfig>) {
    super();
    const merged: OpenAiConfig = { ...readOpenAiConfig(), ...(config ?? {}) };
    // When Model Garden mode is enabled but no explicit Garden baseUrl was
    // provided, derive it from the project/location so callers can simply pass
    // `{ useVertexModelGarden: true, projectId, location }`.
    if (merged.useVertexModelGarden && !/aiplatform\.googleapis\.com/.test(merged.baseUrl)) {
      merged.baseUrl = buildVertexModelGardenBaseUrl(merged.projectId, merged.location);
    }
    this.config = merged;
    this.model = merged.model;
  }

  isEnabled(): boolean {
    return (
      this.config.enabled &&
      (this.config.useVertexModelGarden || Boolean(this.config.apiKey))
    );
  }

  isVertexModelGarden(): boolean {
    return this.config.useVertexModelGarden;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    if (this.config.useVertexModelGarden) {
      const token = await getGcpAccessToken();
      return { Authorization: `Bearer ${token}` };
    }
    return { Authorization: `Bearer ${this.config.apiKey}` };
  }

  private qualifyModel(model: string): string {
    return this.config.useVertexModelGarden ? `openai/${model}` : model;
  }

  protected async rawChat(
    messages: AiMessage[],
    opts: { maxTokens: number; temperature: number; json: boolean; signal?: AbortSignal }
  ): Promise<{ text: string; error?: string }> {
    try {
      const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        signal: opts.signal,
        headers: {
          "Content-Type": "application/json",
          ...(await this.authHeaders()),
        },
        body: JSON.stringify({
          model: this.qualifyModel(this.config.model),
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: opts.maxTokens,
          temperature: opts.temperature,
          ...(opts.json && !this.config.useVertexModelGarden
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { text: "", error: `${res.status} ${res.statusText} ${body.slice(0, 120)}` };
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) return { text: "", error: "Empty response from OpenAI" };
      return { text };
    } catch (err) {
      return { text: "", error: err instanceof Error ? err.message : String(err) };
    }
  }

  async embed(texts: string[]): Promise<AiResult<number[][]>> {
    if (!this.isEnabled() || texts.length === 0) {
      return { ok: false, error: "OpenAI embeddings not enabled", model: this.config.embeddingModel, provider: this.name };
    }
    try {
      // Model Garden rejects the `dimensions` parameter; only send it for the
      // classic OpenAI API.
      const payload: Record<string, unknown> = {
        model: this.qualifyModel(this.config.embeddingModel),
        input: texts,
      };
      if (!this.config.useVertexModelGarden) {
        payload.dimensions = this.config.embeddingDimensions;
      }
      const res = await fetch(`${this.config.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await this.authHeaders()),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, error: `${res.status} ${res.statusText} ${body.slice(0, 120)}`, model: this.config.embeddingModel, provider: this.name };
      }
      const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
      const vectors = (data.data ?? []).map((d) => d.embedding ?? []);
      if (vectors.length === 0) return { ok: false, error: "Empty response from OpenAI", model: this.config.embeddingModel, provider: this.name };
      return { ok: true, data: vectors, model: this.config.embeddingModel, provider: this.name };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err), model: this.config.embeddingModel, provider: this.name };
    }
  }
}

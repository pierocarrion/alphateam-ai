import { VertexAI } from "@google-cloud/vertexai";
import type { AiMessage, AiResult } from "../types";
import { BaseAiProvider } from "../baseProvider";
import { extractCandidateText } from "@/server/lib/ai/geminiParts";

interface GeminiConfig {
  projectId: string;
  location: string;
  model: string;
  enabled: boolean;
  embeddingModel: string;
}

export function readGeminiConfig(env: NodeJS.ProcessEnv = process.env): GeminiConfig {
  return {
    projectId: env.GOOGLE_CLOUD_PROJECT_ID ?? "",
    location: env.VERTEX_AI_LOCATION ?? "us-central1",
    model: env.GEMINI_MODEL ?? "gemini-2.5-flash",
    enabled: env.GEMINI_ENABLED === "true",
    embeddingModel: env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004",
  };
}

export class GeminiProvider extends BaseAiProvider {
  readonly name = "gemini";
  readonly model: string;
  private readonly config: GeminiConfig;
  private vertex: VertexAI | null = null;

  constructor(config?: Partial<GeminiConfig>) {
    super();
    this.config = { ...readGeminiConfig(), ...config };
    this.model = this.config.model;
  }

  isEnabled(): boolean {
    return this.config.enabled && Boolean(this.config.projectId && this.config.location);
  }

  private getClient(): VertexAI | null {
    if (!this.isEnabled()) return null;
    if (!this.vertex) {
      this.vertex = new VertexAI({
        project: this.config.projectId,
        location: this.config.location,
      });
    }
    return this.vertex;
  }

  protected async rawChat(
    messages: AiMessage[],
    opts: { maxTokens: number; temperature: number; json: boolean; signal?: AbortSignal }
  ): Promise<{ text: string; error?: string }> {
    const client = this.getClient();
    if (!client) return { text: "", error: "Gemini not enabled or misconfigured" };

    const model = client.preview.getGenerativeModel({
      model: this.config.model,
      generationConfig: {
        maxOutputTokens: opts.maxTokens,
        temperature: opts.temperature,
        topP: 0.95,
        topK: 40,
      },
    });

    // The installed Vertex SDK has no typed systemInstruction support, so we
    // prepend system messages into the first user turn (same pattern as the
    // existing gemini.ts engine).
    const systemText = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const turns = messages.filter((m) => m.role !== "system");
    if (turns.length === 0) return { text: "", error: "Empty response from Gemini" };
    const first = turns[0];
    const mergedFirst = systemText
      ? { role: first.role, content: `${systemText}\n\n${first.content}` }
      : first;
    const contents = [mergedFirst, ...turns.slice(1)].map((m) => ({
      role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
      parts: [{ text: m.content }],
    }));

    try {
      const result = await model.generateContent({ contents });
      const candidate = result.response.candidates?.[0];
      const text = extractCandidateText(candidate);
      if (!text) return { text: "", error: "Empty response from Gemini" };
      return { text };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { text: "", error: message };
    }
  }

  async embed(texts: string[]): Promise<AiResult<number[][]>> {
    if (!this.isEnabled() || texts.length === 0) {
      return { ok: false, error: "Gemini embeddings not enabled", model: this.config.embeddingModel, provider: this.name };
    }
    const client = this.getClient();
    if (!client) return { ok: false, error: "Gemini not enabled", model: this.config.embeddingModel, provider: this.name };
    try {
      // The installed SDK version doesn't expose getEmbeddingModel in its
      // types; access the preview surface loosely and validate the result.
      const preview = client.preview as unknown as {
        getEmbeddingModel?(args: { model: string }): {
          embed(args: { content: { parts: { text: string }[] } }): Promise<{
            embeddings?: Array<{ values?: number[] }>;
          }>;
        };
      };
      const embeddingModel = preview.getEmbeddingModel?.({ model: this.config.embeddingModel });
      if (!embeddingModel) {
        return { ok: false, error: "Gemini embeddings unavailable in this SDK version", model: this.config.embeddingModel, provider: this.name };
      }
      const result = await embeddingModel.embed({
        content: { parts: texts.map((t) => ({ text: t })) },
      });
      const vectors = (result.embeddings ?? []).map((e) => e.values ?? []);
      if (vectors.length === 0) return { ok: false, error: "Empty response from Gemini", model: this.config.embeddingModel, provider: this.name };
      return { ok: true, data: vectors, model: this.config.embeddingModel, provider: this.name };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message, model: this.config.embeddingModel, provider: this.name };
    }
  }
}

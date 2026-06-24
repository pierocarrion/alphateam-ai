import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OpenAIProvider,
  buildVertexModelGardenBaseUrl,
  readOpenAiConfig,
} from "./OpenAIProvider";
import * as gcpAuth from "../gcpAuth";

describe("buildVertexModelGardenBaseUrl", () => {
  it("builds the canonical Vertex AI Model Garden OpenAI-compatible URL", () => {
    expect(buildVertexModelGardenBaseUrl("my-proj", "us-central1")).toBe(
      "https://us-central1-aiplatform.googleapis.com/v1beta1/projects/my-proj/locations/us-central1/endpoints/openapi"
    );
  });
});

describe("readOpenAiConfig - Vertex AI Model Garden mode", () => {
  it("enables Model Garden mode when OPENAI_USE_VERTEX_MODEL_GARDEN=true", () => {
    const cfg = readOpenAiConfig({
      OPENAI_USE_VERTEX_MODEL_GARDEN: "true",
      GOOGLE_CLOUD_PROJECT_ID: "proj-x",
      VERTEX_AI_LOCATION: "europe-west1",
    } as NodeJS.ProcessEnv);
    expect(cfg.useVertexModelGarden).toBe(true);
    expect(cfg.enabled).toBe(true);
    expect(cfg.apiKey).toBe("");
    expect(cfg.baseUrl).toBe(buildVertexModelGardenBaseUrl("proj-x", "europe-west1"));
  });

  it("auto-detects Model Garden when baseUrl points to aiplatform.googleapis.com", () => {
    const cfg = readOpenAiConfig({
      OPENAI_BASE_URL:
        "https://us-central1-aiplatform.googleapis.com/v1beta1/projects/p/locations/us-central1/endpoints/openapi",
    } as NodeJS.ProcessEnv);
    expect(cfg.useVertexModelGarden).toBe(true);
  });

  it("falls back to classic OpenAI mode without GCP config", () => {
    const cfg = readOpenAiConfig({
      OPENAI_API_KEY: "sk-test",
      OPENAI_BASE_URL: "https://api.openai.com/v1",
    } as NodeJS.ProcessEnv);
    expect(cfg.useVertexModelGarden).toBe(false);
    expect(cfg.enabled).toBe(true);
  });

  it("is disabled in Model Garden mode when project id is missing", () => {
    const cfg = readOpenAiConfig({
      OPENAI_USE_VERTEX_MODEL_GARDEN: "true",
      GOOGLE_CLOUD_PROJECT_ID: "",
    } as NodeJS.ProcessEnv);
    expect(cfg.enabled).toBe(false);
  });
});

describe("OpenAIProvider - Model Garden behavior", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let tokenSpy: ReturnType<typeof vi.spyFunction>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    tokenSpy = vi.spyOn(gcpAuth, "getGcpAccessToken").mockResolvedValue("gcp-token-123");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses GCP access token and publisher-qualified model when embedding via Model Garden", async () => {
    const provider = new OpenAIProvider({
      useVertexModelGarden: true,
      projectId: "proj-x",
      location: "us-central1",
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      enabled: true,
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }),
    });

    const result = await provider.embed(["hello"]);

    expect(result.ok).toBe(true);
    expect(tokenSpy).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("aiplatform.googleapis.com");
    expect(url).toContain("/embeddings");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer gcp-token-123",
    });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("openai/text-embedding-3-small");
    // dimensions must not be sent to Model Garden (it rejects the param).
    expect(body.dimensions).toBeUndefined();
  });

  it("uses classic Bearer <api key> and bare model name when not in Model Garden mode", async () => {
    const provider = new OpenAIProvider({
      useVertexModelGarden: false,
      apiKey: "sk-classic",
      baseUrl: "https://api.openai.com/v1",
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      enabled: true,
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1] }] }),
    });

    const result = await provider.embed(["hi"]);
    expect(result.ok).toBe(true);
    expect(tokenSpy).not.toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer sk-classic",
    });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("text-embedding-3-small");
    expect(body.dimensions).toBe(1536);
  });

  it("reports isEnabled=false when disabled", () => {
    const provider = new OpenAIProvider({ enabled: false });
    expect(provider.isEnabled()).toBe(false);
  });

  it("exposes Model Garden mode via isVertexModelGarden()", () => {
    expect(
      new OpenAIProvider({ useVertexModelGarden: true, projectId: "p", location: "l", enabled: true }).isVertexModelGarden()
    ).toBe(true);
    expect(
      new OpenAIProvider({ useVertexModelGarden: false, apiKey: "k", enabled: true }).isVertexModelGarden()
    ).toBe(false);
  });
});

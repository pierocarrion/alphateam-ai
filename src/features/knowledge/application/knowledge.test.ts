import { describe, expect, it } from "vitest";
import type { IKnowledgeRepository } from "../domain/repositories/IKnowledgeRepository";
import type { KnowledgeResource } from "../domain/entities/KnowledgeResource";
import { IngestDocument } from "./use-cases/IngestDocument";
import { SearchKnowledge } from "./use-cases/SearchKnowledge";
import { InMemoryVectorStore, setVectorStore } from "@/server/lib/ai/vectorStore";
import type { IAiClient } from "@/server/lib/ai/client";

function makeResource(overrides: Partial<KnowledgeResource> = {}): KnowledgeResource {
  return {
    id: "r1",
    workspaceId: "w1",
    categoryId: null,
    title: "Onboarding playbook",
    summary: null,
    contentText: "Welcome. Step one is...",
    fileType: "text",
    storageKey: null,
    sourceUrl: null,
    sourceApp: null,
    sourceType: "manual",
    authorId: null,
    projectId: null,
    accessLevel: "workspace",
    isPremium: false,
    tags: ["onboarding"],
    keywords: [],
    status: "active",
    viewCount: 0,
    useCount: 0,
    aiMetadata: null,
    version: 1,
    createdById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeFakeRepo(
  resources: KnowledgeResource[],
  chunks: { id: string; resourceId: string; ordinal: number; text: string }[] = []
): IKnowledgeRepository {
  return {
    listCategories: async () => [],
    createCategory: async () => {
      throw new Error("noop");
    },
    findCategoryByKey: async () => null,
    get: async (id) => {
      const r = resources.find((x) => x.id === id);
      return r ? { ...r, category: null, _chunkCount: 0 } : null;
    },
    list: async (filter) => {
      let out = resources.filter((r) => r.workspaceId === filter.workspaceId && r.status === "active");
      if (filter.search) {
        const s = filter.search.toLowerCase();
        out = out.filter(
          (r) =>
            r.title.toLowerCase().includes(s) ||
            r.contentText.toLowerCase().includes(s) ||
            r.tags.some((t) => t.toLowerCase().includes(s))
        );
      }
      return out.slice(0, filter.limit ?? 50).map((r) => ({ ...r, category: null }));
    },
    count: async (filter) => resources.filter((r) => r.workspaceId === filter.workspaceId).length,
    create: async (input) => makeResource({ id: "new", ...input }) as KnowledgeResource,
    update: async (id, patch) => ({ ...(resources.find((r) => r.id === id) ?? makeResource()), ...patch }) as KnowledgeResource,
    delete: async () => undefined,
    incrementView: async () => undefined,
    incrementUse: async () => undefined,
    replaceChunks: async (resourceId, newChunks) => {
      chunks.splice(0, chunks.length);
      const inserted: { id: string; ordinal: number; text: string; tokenCount: number | null }[] = [];
      newChunks.forEach((c, i) => {
        const id = `${resourceId}:${i}`;
        chunks.push({ id, resourceId, ordinal: i, text: c.text });
        inserted.push({ id, ordinal: i, text: c.text, tokenCount: c.tokenCount ?? null });
      });
      return inserted;
    },
    listChunks: async () => chunks,
    getChunk: async (id) => chunks.find((c) => c.id === id) ?? null,
    listVersions: async () => [],
    addVersion: async () => {
      throw new Error("noop");
    },
    listSuggestions: async () => [],
    addSuggestion: async () => {
      throw new Error("noop");
    },
    dismissSuggestion: async () => undefined,
  };
}

function makeFakeAi(embeddings: Record<string, number[]>): IAiClient {
  return {
    providerName: "fake",
    provider: {
      name: "fake",
      model: "fake-1",
      isEnabled: () => false,
      chat: async () => ({ ok: false, error: "disabled", model: "fake-1", provider: "fake" }),
      chatJSON: async () => ({ ok: false, error: "disabled", model: "fake-1", provider: "fake" }),
      embed: async (texts) => ({
        ok: true,
        data: texts.map((t) => embeddings[t] ?? [0, 0, 0]),
        model: "fake-embed",
        provider: "fake",
      }),
    },
    embedder: {
      name: "fake",
      model: "fake-embed",
      isEnabled: () => true,
      embed: async (texts) => ({
        ok: true,
        data: texts.map((t) => embeddings[t] ?? [0, 0, 0]),
        model: "fake-embed",
        provider: "fake",
      }),
    },
  };
}

describe("IngestDocument", () => {
  it("chunks, embeds and upserts vectors into the store", async () => {
    setVectorStore(new InMemoryVectorStore());
    const chunks: { id: string; resourceId: string; ordinal: number; text: string }[] = [];
    const repo = makeFakeRepo([], chunks);
    const ai = makeFakeAi({});
    const useCase = new IngestDocument(repo, ai);

    const result = await useCase.run({ resource: makeResource({ contentText: "First sentence here. Second sentence is longer and meaningful. Third one to force packing." }) });

    expect(result.vectors).toBeGreaterThan(0);
    expect(chunks.length).toBe(result.chunks);
    expect(result.enriched).toBe(false);
  });

  it("clears vectors when content has no chunks", async () => {
    const store = new InMemoryVectorStore();
    await store.upsert([{ id: "r1:0", vector: [1, 1], metadata: { resourceId: "r1", workspaceId: "w1" } }]);
    setVectorStore(store);
    const repo = makeFakeRepo([]);
    const useCase = new IngestDocument(repo, makeFakeAi({}));
    await useCase.run({ resource: makeResource({ contentText: "   " }) });
    expect(await store.count()).toBe(0);
  });
});

describe("SearchKnowledge", () => {
  it("fuses semantic + keyword results via reciprocal rank fusion", async () => {
    const store = new InMemoryVectorStore();
    await store.upsert([
      { id: "r1:0", vector: [1, 0, 0], metadata: { resourceId: "r1", workspaceId: "w1", chunkId: "r1:0" } },
      { id: "r2:0", vector: [0, 1, 0], metadata: { resourceId: "r2", workspaceId: "w1", chunkId: "r2:0" } },
    ]);
    setVectorStore(store);

    const resources = [
      makeResource({ id: "r1", title: "Onboarding", contentText: "how to onboard", tags: ["onboarding"] }),
      makeResource({ id: "r2", title: "Sales", contentText: "sales playbook", tags: ["sales"] }),
    ];
    const repo = makeFakeRepo(resources, [
      { id: "r1:0", resourceId: "r1", ordinal: 0, text: "onboarding step one" },
      { id: "r2:0", resourceId: "r2", ordinal: 0, text: "sales step one" },
    ]);
    const ai = makeFakeAi({ onboarding: [1, 0, 0] });
    const search = new SearchKnowledge(repo, ai);

    const results = await search.hybrid({ workspaceId: "w1", query: "onboarding" });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].resource.id).toBe("r1");
    expect(results[0].source).toBe("hybrid");
  });

  it("returns semantic hits only when keyword finds nothing", async () => {
    const store = new InMemoryVectorStore();
    await store.upsert([
      { id: "r9:0", vector: [1, 0, 0], metadata: { resourceId: "r9", workspaceId: "w1", chunkId: "r9:0" } },
    ]);
    setVectorStore(store);
    const repo = makeFakeRepo([
      makeResource({ id: "r9", title: "Hidden", contentText: "something different", tags: [] }),
    ], [{ id: "r9:0", resourceId: "r9", ordinal: 0, text: "hidden content" }]);
    const ai = makeFakeAi({ query: [1, 0, 0] });
    const search = new SearchKnowledge(repo, ai);

    const semantic = await search.semantic({ workspaceId: "w1", query: "query" });
    expect(semantic.hits.length).toBe(1);
    expect(semantic.hits[0].resourceId).toBe("r9");
  });
});

import { describe, it, expect } from "vitest";
import { PgVectorStore } from "./PgVectorStore";
import { getTestDb, seedWorkspace } from "@/tests/helpers/db";
import { knowledgeResource, knowledgeChunk } from "@drizzle/schema";

const DIM = 768;

/** Builds a deterministic 768-dim vector with the value at `idx` set to 1. */
function unit(idx: number): number[] {
  const v = new Array(DIM).fill(0);
  v[idx] = 1;
  return v;
}

describe("PgVectorStore (backed by PGlite + pgvector)", () => {
  it("upserts embeddings onto KnowledgeChunk rows and queries by cosine distance", async () => {
    const db = await getTestDb();
    const { workspace } = await seedWorkspace();

    const [res] = await db
      .insert(knowledgeResource)
      .values({
        workspaceId: workspace.id,
        title: "Tech stack",
        contentText: "Se usará .NET y Flutter como frameworks de la app",
        status: "active",
      })
      .returning();
    expect(res).toBeTruthy();

    const [chunk] = await db
      .insert(knowledgeChunk)
      .values({
        resourceId: res!.id,
        ordinal: 0,
        text: "Se usará .NET y Flutter como frameworks de la app",
      })
      .returning();
    expect(chunk).toBeTruthy();

    const store = new PgVectorStore();
    const techVector = unit(0);
    const salesVector = unit(1);
    await store.upsert([
      {
        id: chunk!.id,
        vector: techVector,
        metadata: { resourceId: res!.id, workspaceId: workspace.id, chunkId: chunk!.id, ordinal: 0 },
      },
    ]);

    // Query with the exact embedding → top hit should be the chunk we seeded.
    const hits = await store.query(techVector, { topK: 5, filter: { workspaceId: workspace.id } });
    expect(hits.length).toBe(1);
    expect(hits[0].id).toBe(chunk!.id);
    expect(hits[0].score).toBeGreaterThan(0.99);
    expect(hits[0].metadata.resourceId).toBe(res!.id);

    // Query with an orthogonal vector → still returns the chunk (workspace-scoped)
    // but with ~0 similarity, proving cosine distance applies.
    const empty = await store.query(salesVector, { topK: 5, filter: { workspaceId: workspace.id } });
    expect(empty.length).toBe(1);
    expect(empty[0]?.score ?? 0).toBeLessThanOrEqual(0.01);
  });

  it("scopes by workspaceId so unrelated workspaces don't leak", async () => {
    const db = await getTestDb();
    const { workspace: wsA } = await seedWorkspace();
    const { workspace: wsB } = await seedWorkspace();

    const [resA] = await db
      .insert(knowledgeResource)
      .values({ workspaceId: wsA.id, title: "A only", contentText: "x", status: "active" })
      .returning();
    const [chunkA] = await db
      .insert(knowledgeChunk)
      .values({ resourceId: resA!.id, ordinal: 0, text: "row a" })
      .returning();

    const store = new PgVectorStore();
    await store.upsert([{ id: chunkA!.id, vector: unit(0), metadata: { resourceId: resA!.id, workspaceId: wsA.id, chunkId: chunkA!.id } }]);

    // Searching from workspace B returns nothing.
    const bHits = await store.query(unit(0), { topK: 5, filter: { workspaceId: wsB.id } });
    expect(bHits).toHaveLength(0);

    // Searching from workspace A returns the chunk.
    const aHits = await store.query(unit(0), { topK: 5, filter: { workspaceId: wsA.id } });
    expect(aHits).toHaveLength(1);
    expect(aHits[0].id).toBe(chunkA!.id);
  });

  it("deleteByMetadata clears embeddings for a resource without dropping the chunk rows", async () => {
    const db = await getTestDb();
    const { workspace } = await seedWorkspace();
    const [res] = await db
      .insert(knowledgeResource)
      .values({ workspaceId: workspace.id, title: "delete me", contentText: "y", status: "active" })
      .returning();
    const [chunk] = await db
      .insert(knowledgeChunk)
      .values({ resourceId: res!.id, ordinal: 0, text: "row y" })
      .returning();

    const store = new PgVectorStore();
    await store.upsert([{ id: chunk!.id, vector: unit(2), metadata: { resourceId: res!.id, workspaceId: workspace.id, chunkId: chunk!.id } }]);
    await store.deleteByMetadata({ resourceId: res!.id });

    // Embedding cleared → vector query returns nothing.
    const hits = await store.query(unit(2), { topK: 5, filter: { workspaceId: workspace.id } });
    expect(hits).toHaveLength(0);

    // But the chunk row itself is untouched (it's owned by replaceChunks).
    const leftover = await db.query.knowledgeChunk.findFirst({
      where: (c, { eq }) => eq(c.id, chunk!.id),
    });
    expect(leftover).toBeTruthy();
    expect(leftover?.embedding).toBeNull();
  });

  it("count reports vectors scoped by workspace", async () => {
    const db = await getTestDb();
    const { workspace } = await seedWorkspace();
    const [res] = await db
      .insert(knowledgeResource)
      .values({ workspaceId: workspace.id, title: "c", contentText: "z", status: "active" })
      .returning();
    const [chunk] = await db
      .insert(knowledgeChunk)
      .values({ resourceId: res!.id, ordinal: 0, text: "row c" })
      .returning();

    const store = new PgVectorStore();
    expect(await store.count({ workspaceId: workspace.id })).toBe(0);
    await store.upsert([{ id: chunk!.id, vector: unit(3), metadata: { resourceId: res!.id, workspaceId: workspace.id, chunkId: chunk!.id } }]);
    expect(await store.count({ workspaceId: workspace.id })).toBe(1);
  });
});
import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  vector,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { cuid, ts } from "./_shared";
import { workspace } from "./workspace";

// ===== Knowledge Hub =====

export const knowledgeCategory = pgTable(
  "KnowledgeCategory",
  {
    id: text().primaryKey().$defaultFn(cuid),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // marketing, strategy, operations, ...
    key: text().notNull(),
    name: text().notNull(),
    // hex or color token
    color: text(),
    icon: text(),
    isDefault: boolean().default(false).notNull(),
    createdAt: timestamp(ts).defaultNow().notNull(),
    updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (t) => ({
    wsKey: unique("KnowledgeCategory_workspaceId_key_key").on(
      t.workspaceId,
      t.key
    ),
    byWs: index("KnowledgeCategory_workspaceId_idx").on(t.workspaceId),
  })
);

export const knowledgeResource = pgTable(
  "KnowledgeResource",
  {
    id: text().primaryKey().$defaultFn(cuid),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    categoryId: text().references(() => knowledgeCategory.id, {
      onDelete: "set null",
    }),
    title: text().notNull(),
    // AI-generated summary
    summary: text(),
    // extracted plain text (for keyword search + chunks)
    contentText: text().notNull(),
    // text | pdf | docx | xlsx | pptx | image | video | link
    fileType: text().default("text").notNull(),
    // key in IFileStorage (GCS / local)
    storageKey: text(),
    sourceUrl: text(),
    // slack | teams | gdrive | manual | ...
    sourceApp: text(),
    // manual | upload | link | capture
    sourceType: text().default("manual").notNull(),
    // no strong relation (same as AuditLog.actorId)
    authorId: text(),
    projectId: text(),
    // workspace | leaders | members
    accessLevel: text().default("workspace").notNull(),
    isPremium: boolean().default(false).notNull(),
    tags: text().array().notNull().default([]),
    // AI-extracted
    keywords: text().array().notNull().default([]),
    // active | processing | archived
    status: text().default("active").notNull(),
    viewCount: integer().default(0).notNull(),
    useCount: integer().default(0).notNull(),
    // { language, readingTime, confidence, topics, ... }
    aiMetadata: jsonb().$type<unknown>(),
    version: integer().default(1).notNull(),
    createdById: text(),
    createdAt: timestamp(ts).defaultNow().notNull(),
    updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (t) => ({
    byWsStatus: index("KnowledgeResource_workspaceId_status_idx").on(
      t.workspaceId,
      t.status
    ),
    byWsCategory: index("KnowledgeResource_workspaceId_categoryId_idx").on(
      t.workspaceId,
      t.categoryId
    ),
    byWsPremium: index("KnowledgeResource_workspaceId_isPremium_idx").on(
      t.workspaceId,
      t.isPremium
    ),
    byWsUpdated: index("KnowledgeResource_workspaceId_updatedAt_idx").on(
      t.workspaceId,
      t.updatedAt
    ),
  })
);

export const knowledgeChunk = pgTable(
  "KnowledgeChunk",
  {
    id: text().primaryKey().$defaultFn(cuid),
    resourceId: text()
      .notNull()
      .references(() => knowledgeResource.id, { onDelete: "cascade" }),
    ordinal: integer().notNull(),
    text: text().notNull(),
    tokenCount: integer(),
    // pgvector-backed embedding (dim 768 matches Gemini text-embedding-004).
    // Null until IngestDocument runs; upserts overwrite in place. The ivfflat
    // index is created out-of-band against Cloud SQL (see scripts/pgvector.sql
    // and cloudbuild-migrate.yaml) because drizzle-kit's DSL doesn't emit
    // `USING ivfflat … WITH (lists=…)` and PGlite's vector plugin doesn't
    // support ivfflat indexes — only the column type itself.
    embedding: vector("embedding", { dimensions: 768 }),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    byResourceOrdinal: index("KnowledgeChunk_resourceId_ordinal_idx").on(
      t.resourceId,
      t.ordinal
    ),
  })
);

export const knowledgeResourceVersion = pgTable(
  "KnowledgeResourceVersion",
  {
    id: text().primaryKey().$defaultFn(cuid),
    resourceId: text()
      .notNull()
      .references(() => knowledgeResource.id, { onDelete: "cascade" }),
    version: integer().notNull(),
    title: text().notNull(),
    contentText: text().notNull(),
    summary: text(),
    changedById: text(),
    changeNote: text(),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    byResourceVersion: index(
      "KnowledgeResourceVersion_resourceId_version_idx"
    ).on(t.resourceId, t.version),
  })
);

export const knowledgeSuggestion = pgTable(
  "KnowledgeSuggestion",
  {
    id: text().primaryKey().$defaultFn(cuid),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    resourceId: text().references(() => knowledgeResource.id, {
      onDelete: "set null",
    }),
    targetUserId: text(),
    reason: text().notNull(),
    // topic_match | risk | gap | retrieval
    kind: text().default("topic_match").notNull(),
    dismissed: boolean().default(false).notNull(),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    byWsCreated: index("KnowledgeSuggestion_workspaceId_createdAt_idx").on(
      t.workspaceId,
      t.createdAt
    ),
    byTargetDismissed: index(
      "KnowledgeSuggestion_targetUserId_dismissed_idx"
    ).on(t.targetUserId, t.dismissed),
  })
);

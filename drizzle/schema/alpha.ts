import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { cuid, ts } from "./_shared";
import { user } from "./auth";
import { workspace } from "./workspace";

// ===== Alpha Space (Strategic Thinking Space) =====

export const alphaSession = pgTable(
  "AlphaSession",
  {
    id: text().primaryKey().$defaultFn(cuid),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    title: text().notNull(),
    // strategic_dialogue | lean_ux | decision_brief | action_plan | ...
    framework: text().default("strategic_dialogue").notNull(),
    // main challenge identified
    challenge: text(),
    // active | completed | archived
    status: text().default("active").notNull(),
    // guided flow stage
    step: integer().default(0).notNull(),
    // editable executive document in progress
    documentJson: jsonb().$type<unknown>(),
    createdAt: timestamp(ts).defaultNow().notNull(),
    updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
    completedAt: timestamp(ts),
  },
  (t) => ({
    byUserCreated: index("AlphaSession_userId_createdAt_idx").on(
      t.userId,
      t.createdAt
    ),
    byWsCreated: index("AlphaSession_workspaceId_createdAt_idx").on(
      t.workspaceId,
      t.createdAt
    ),
  })
);

export const alphaMessage = pgTable(
  "AlphaMessage",
  {
    id: text().primaryKey().$defaultFn(cuid),
    sessionId: text()
      .notNull()
      .references(() => alphaSession.id, { onDelete: "cascade" }),
    // user | coach | system
    role: text().notNull(),
    content: text().notNull(),
    // { step, field, suggestion }
    meta: jsonb().$type<unknown>(),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    bySessionCreated: index("AlphaMessage_sessionId_createdAt_idx").on(
      t.sessionId,
      t.createdAt
    ),
  })
);

export const alphaDocument = pgTable(
  "AlphaDocument",
  {
    id: text().primaryKey().$defaultFn(cuid),
    sessionId: text()
      .unique()
      .notNull()
      .references(() => alphaSession.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    title: text().notNull(),
    // lean_ux | action_plan | decision_brief | strategy | feedback_plan
    kind: text().default("decision_brief").notNull(),
    // [{ id, label, content }]
    sections: jsonb().notNull().$type<unknown[]>(),
    createdAt: timestamp(ts).defaultNow().notNull(),
    updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (t) => ({
    byUserUpdated: index("AlphaDocument_userId_updatedAt_idx").on(
      t.userId,
      t.updatedAt
    ),
  })
);

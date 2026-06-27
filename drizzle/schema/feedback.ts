import {
  pgTable,
  text,
  timestamp,
  doublePrecision,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { cuid, ts } from "./_shared";
import { user } from "./auth";
import { workspace } from "./workspace";

export const feedback = pgTable(
  "Feedback",
  {
    id: text().primaryKey().$defaultFn(cuid),
    workspaceId: text().references(() => workspace.id, { onDelete: "set null" }),
    userId: text().references(() => user.id, { onDelete: "set null" }),
    // win, struggle, testimonial, metric
    type: text().notNull(),
    content: text().notNull(),
    metricValue: doublePrecision(),
    tags: text().array().notNull().default([]),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    byWsType: index("Feedback_workspaceId_type_idx").on(t.workspaceId, t.type),
    byCreated: index("Feedback_createdAt_idx").on(t.createdAt),
  })
);

// ===== Feedback Intelligence (Anonymous Feedback) =====

export const feedbackCampaign = pgTable(
  "FeedbackCampaign",
  {
    id: text().primaryKey().$defaultFn(cuid),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    title: text().notNull(),
    // pulse | onboarding | exit | contextual | 360
    kind: text().default("pulse").notNull(),
    // [{ id, text, type }]
    questions: jsonb().notNull().$type<unknown[]>(),
    // weekly | monthly | ad_hoc
    cadence: text().default("weekly").notNull(),
    // draft | active | closed
    status: text().default("active").notNull(),
    startsAt: timestamp(ts),
    endsAt: timestamp(ts),
    createdAt: timestamp(ts).defaultNow().notNull(),
    updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (t) => ({
    byWsStatus: index("FeedbackCampaign_workspaceId_status_idx").on(
      t.workspaceId,
      t.status
    ),
    byWsCreated: index("FeedbackCampaign_workspaceId_createdAt_idx").on(
      t.workspaceId,
      t.createdAt
    ),
  })
);

export const feedbackResponse = pgTable(
  "FeedbackResponse",
  {
    id: text().primaryKey().$defaultFn(cuid),
    campaignId: text()
      .notNull()
      .references(() => feedbackCampaign.id, { onDelete: "cascade" }),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // stored ONLY for uniqueness control (anonymous hash); never shown to leaders
    submitterHash: text(),
    // { questionId -> answer } + free text
    payload: jsonb().notNull().$type<unknown>(),
    // AI-derived metrics
    sentiment: text(),
    emotion: text(),
    scores: jsonb().$type<unknown>(),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    byCampaignCreated: index("FeedbackResponse_campaignId_createdAt_idx").on(
      t.campaignId,
      t.createdAt
    ),
    byWsSentiment: index("FeedbackResponse_workspaceId_sentiment_idx").on(
      t.workspaceId,
      t.sentiment
    ),
    byWsCreated: index("FeedbackResponse_workspaceId_createdAt_idx").on(
      t.workspaceId,
      t.createdAt
    ),
  })
);

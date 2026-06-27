import {
  pgTable,
  text,
  timestamp,
  integer,
  doublePrecision,
  boolean,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { cuid, ts } from "./_shared";
import { user } from "./auth";
import { message } from "./messaging";
import { goal, workspace } from "./workspace";

export const task = pgTable("Task", {
  id: text().primaryKey().$defaultFn(cuid),
  messageId: text().references(() => message.id, { onDelete: "set null" }),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  smartGoalId: text().references(() => goal.id, { onDelete: "set null" }),
  title: text().notNull(),
  fromQuote: text(),
  category: text().default("General").notNull(),
  app: text().default("Knowledge base").notNull(),
  due: text(),
  deadline: timestamp(ts),
  load: text().default("Light").notNull(),
  micro: text().notNull(),
  action: text().notNull(),
  resource: text().default("Untitled").notNull(),
  selfMade: boolean().default(false).notNull(),
  status: text().default("open").notNull(),
  // q1, q2, q3, q4 (Eisenhower)
  quadrant: text(),
  estimatedMinutes: integer(),
  // minutes actually worked
  workedMinutes: integer(),
  // 1-5
  priority: integer(),
  tags: text().array().notNull().default([]),
  createdAt: timestamp(ts).defaultNow().notNull(),
  completedAt: timestamp(ts),
});

export const ritualSession = pgTable("RitualSession", {
  id: text().primaryKey().$defaultFn(cuid),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  taskId: text(),
  feeling: text(),
  moodAtStart: text(),
  moodAtEnd: text(),
  durationSec: integer().default(120).notNull(),
  recoveredMinutes: integer(),
  startedAt: timestamp(ts),
  completedAt: timestamp(ts),
  createdAt: timestamp(ts).defaultNow().notNull(),
});

export const dailyCheckIn = pgTable(
  "DailyCheckIn",
  {
    id: text().primaryKey().$defaultFn(cuid),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: timestamp(ts).defaultNow().notNull(),
    mood: text(),
    // 1-5
    energy: integer(),
    notes: text(),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    userDate: unique("DailyCheckIn_userId_date_key").on(t.userId, t.date),
  })
);

export const teamMetric = pgTable(
  "TeamMetric",
  {
    id: text().primaryKey().$defaultFn(cuid),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    date: timestamp(ts).defaultNow().notNull(),
    // mood, load_balance, procrastination_rate, deadlines_missed, recovered_minutes
    type: text().notNull(),
    value: doublePrecision().notNull(),
    metadata: text(),
  },
  (t) => ({
    byWsDate: index("TeamMetric_workspaceId_date_idx").on(t.workspaceId, t.date),
    byWsType: index("TeamMetric_workspaceId_type_idx").on(t.workspaceId, t.type),
  })
);

export const userMetric = pgTable(
  "UserMetric",
  {
    id: text().primaryKey().$defaultFn(cuid),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: timestamp(ts).defaultNow().notNull(),
    // recovered_minutes, rituals_completed, tasks_completed, procrastination_score
    type: text().notNull(),
    value: doublePrecision().notNull(),
    metadata: text(),
  },
  (t) => ({
    byUserDate: index("UserMetric_userId_date_idx").on(t.userId, t.date),
    byUserType: index("UserMetric_userId_type_idx").on(t.userId, t.type),
  })
);

export const pairMatch = pgTable("PairMatch", {
  id: text().primaryKey().$defaultFn(cuid),
  requesterId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  partnerId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  taskId: text(),
  reason: text().notNull(),
  // pending, approved, rejected, completed
  status: text().default("pending").notNull(),
  approvedById: text(),
  createdAt: timestamp(ts).defaultNow().notNull(),
});

export const reward = pgTable("Reward", {
  id: text().primaryKey().$defaultFn(cuid),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // break, badge, recognition
  type: text().notNull(),
  title: text().notNull(),
  triggeredBy: text(),
  claimedAt: timestamp(ts),
  createdAt: timestamp(ts).defaultNow().notNull(),
});

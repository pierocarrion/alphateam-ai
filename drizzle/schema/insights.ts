import {
  pgTable,
  text,
  timestamp,
  integer,
  doublePrecision,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { cuid, ts } from "./_shared";
import { user } from "./auth";
import { workspace } from "./workspace";

// ===== Team Insights (People Analytics) =====

export const learningActivity = pgTable(
  "LearningActivity",
  {
    id: text().primaryKey().$defaultFn(cuid),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // course, certification, workshop, reading
    type: text().notNull(),
    title: text().notNull(),
    skill: text(),
    // beginner, intermediate, advanced, expert
    level: text(),
    hours: doublePrecision().default(0).notNull(),
    startedAt: timestamp(ts),
    completedAt: timestamp(ts),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    byWsCompleted: index("LearningActivity_workspaceId_completedAt_idx").on(
      t.workspaceId,
      t.completedAt
    ),
    byUserCompleted: index("LearningActivity_userId_completedAt_idx").on(
      t.userId,
      t.completedAt
    ),
    byWsSkill: index("LearningActivity_workspaceId_skill_idx").on(
      t.workspaceId,
      t.skill
    ),
  })
);

export const survey = pgTable(
  "Survey",
  {
    id: text().primaryKey().$defaultFn(cuid),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // 0-100
    psychologicalSafety: integer().notNull(),
    // positive, neutral, risk
    sentiment: text().notNull(),
    comment: text(),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    byWsCreated: index("Survey_workspaceId_createdAt_idx").on(
      t.workspaceId,
      t.createdAt
    ),
    byUserCreated: index("Survey_userId_createdAt_idx").on(
      t.userId,
      t.createdAt
    ),
  })
);

export const employeeSkill = pgTable(
  "EmployeeSkill",
  {
    id: text().primaryKey().$defaultFn(cuid),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    skill: text().notNull(),
    // beginner, intermediate, advanced, expert
    level: text().notNull(),
    updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (t) => ({
    userWsSkill: unique("EmployeeSkill_userId_workspaceId_skill_key").on(
      t.userId,
      t.workspaceId,
      t.skill
    ),
    byWsSkill: index("EmployeeSkill_workspaceId_skill_idx").on(
      t.workspaceId,
      t.skill
    ),
  })
);

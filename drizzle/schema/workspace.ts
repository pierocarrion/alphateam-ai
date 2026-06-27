import {
  pgTable,
  text,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { cuid, ts } from "./_shared";
import { user } from "./auth";

export const workspace = pgTable("Workspace", {
  id: text().primaryKey().$defaultFn(cuid),
  name: text().notNull(),
  slug: text().unique().notNull(),
  hashtag: text().unique().notNull(),
  description: text(),
  industry: text(),
  category: text(),
  emoji: text().default("🚀"),
  teamSize: text(),
  createdAt: timestamp(ts).defaultNow().notNull(),
});

export const membership = pgTable(
  "Membership",
  {
    id: text().primaryKey().$defaultFn(cuid),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // member, leader, admin (RBAC permission level)
    role: text().default("member").notNull(),
    // job title: Project Manager, Product Owner, ... (PROJECT_ROLE_KEYS)
    projectRole: text(),
    // active, invited, inactive
    status: text().default("active").notNull(),
    photoUrl: text(),
    invitedEmail: text(),
    // junior, mid, senior, lead
    seniority: text(),
    hireDate: timestamp(ts),
    joinedAt: timestamp(ts).defaultNow().notNull(),
    updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (t) => ({
    userWorkspace: unique("Membership_userId_workspaceId_key").on(
      t.userId,
      t.workspaceId
    ),
    byWsStatus: index("Membership_workspaceId_status_idx").on(
      t.workspaceId,
      t.status
    ),
    byWsRole: index("Membership_workspaceId_projectRole_idx").on(
      t.workspaceId,
      t.projectRole
    ),
  })
);

export const goal = pgTable("Goal", {
  id: text().primaryKey().$defaultFn(cuid),
  workspaceId: text()
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  ownerId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text().notNull(),
  specific: text(),
  measurable: text(),
  achievable: text(),
  relevant: text(),
  deadline: timestamp(ts),
  // active, completed, archived
  status: text().default("active").notNull(),
  createdAt: timestamp(ts).defaultNow().notNull(),
  updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
});

export const milestone = pgTable("Milestone", {
  id: text().primaryKey().$defaultFn(cuid),
  goalId: text()
    .notNull()
    .references(() => goal.id, { onDelete: "cascade" }),
  title: text().notNull(),
  dueDate: timestamp(ts),
  // pending, completed
  status: text().default("pending").notNull(),
  createdAt: timestamp(ts).defaultNow().notNull(),
});

export const template = pgTable("Template", {
  id: text().primaryKey().$defaultFn(cuid),
  workspaceId: text().references(() => workspace.id, { onDelete: "set null" }),
  title: text().notNull(),
  // task, goal, meeting, retro, raci, etc.
  type: text().notNull(),
  industry: text(),
  content: text().notNull(),
  createdAt: timestamp(ts).defaultNow().notNull(),
});

export const knowledgeBaseItem = pgTable("KnowledgeBaseItem", {
  id: text().primaryKey().$defaultFn(cuid),
  workspaceId: text()
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  title: text().notNull(),
  content: text().notNull(),
  sourceApp: text(),
  sourceUrl: text(),
  validatedByLlmAt: timestamp(ts),
  createdAt: timestamp(ts).defaultNow().notNull(),
});

export const meeting = pgTable("Meeting", {
  id: text().primaryKey().$defaultFn(cuid),
  workspaceId: text()
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  ownerId: text(),
  title: text().notNull(),
  reason: text().notNull(),
  scheduledAt: timestamp(ts),
  // pending, scheduled, completed, cancelled
  status: text().default("pending").notNull(),
  createdAt: timestamp(ts).defaultNow().notNull(),
});

export const methodology = pgTable("Methodology", {
  id: text().primaryKey().$defaultFn(cuid),
  workspaceId: text()
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  title: text().notNull(),
  category: text().notNull(),
  content: text().notNull(),
  createdAt: timestamp(ts).defaultNow().notNull(),
});

export const industryDatabase = pgTable("IndustryDatabase", {
  id: text().primaryKey().$defaultFn(cuid),
  workspaceId: text().references(() => workspace.id, { onDelete: "set null" }),
  industry: text().notNull(),
  itemType: text().notNull(),
  data: text().notNull(),
  createdAt: timestamp(ts).defaultNow().notNull(),
});

export const workspaceSubscription = pgTable("WorkspaceSubscription", {
  id: text().primaryKey().$defaultFn(cuid),
  workspaceId: text()
    .unique()
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  stripeCustomerId: text(),
  stripeSubscriptionId: text(),
  // free, team, business
  plan: text().default("free").notNull(),
  // active, trialing, past_due, cancelled
  status: text().default("active").notNull(),
  currentPeriodEnd: timestamp(ts),
  createdAt: timestamp(ts).defaultNow().notNull(),
  updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
});

export const waitlist = pgTable("Waitlist", {
  id: text().primaryKey().$defaultFn(cuid),
  email: text().unique().notNull(),
  role: text(),
  teamSize: text(),
  createdAt: timestamp(ts).defaultNow().notNull(),
});

export const joinRequest = pgTable(
  "JoinRequest",
  {
    id: text().primaryKey().$defaultFn(cuid),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    message: text(),
    // pending, approved, rejected
    status: text().default("pending").notNull(),
    decidedById: text(),
    decidedAt: timestamp(ts),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    wsUser: unique("JoinRequest_workspaceId_userId_key").on(
      t.workspaceId,
      t.userId
    ),
    byStatus: index("JoinRequest_status_idx").on(t.status),
  })
);

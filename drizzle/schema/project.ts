import {
  pgTable,
  text,
  timestamp,
  integer,
  doublePrecision,
  jsonb,
  boolean,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { cuid, ts } from "./_shared";
import { user } from "./auth";
import { workspace } from "./workspace";

// ===== Project Settings module =====

export const projectSmartGoal = pgTable(
  "ProjectSmartGoal",
  {
    id: text().primaryKey().$defaultFn(cuid),
    workspaceId: text()
      .unique()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    title: text().notNull(),
    specific: text(),
    measurable: text(),
    achievable: text(),
    relevant: text(),
    timeBound: text(),
    deadline: timestamp(ts),
    version: integer().default(1).notNull(),
    // 0-100, SMART completeness score (heuristic + AI)
    smartScore: doublePrecision(),
    createdAt: timestamp(ts).defaultNow().notNull(),
    updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (t) => ({
    byWs: index("ProjectSmartGoal_workspaceId_idx").on(t.workspaceId),
  })
);

export const smartGoalVersion = pgTable(
  "SmartGoalVersion",
  {
    id: text().primaryKey().$defaultFn(cuid),
    smartGoalId: text()
      .notNull()
      .references(() => projectSmartGoal.id, { onDelete: "cascade" }),
    version: integer().notNull(),
    title: text().notNull(),
    specific: text(),
    measurable: text(),
    achievable: text(),
    relevant: text(),
    timeBound: text(),
    deadline: timestamp(ts),
    smartScore: doublePrecision(),
    changedById: text(),
    changeNote: text(),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    byGoalVersion: index("SmartGoalVersion_smartGoalId_version_idx").on(
      t.smartGoalId,
      t.version
    ),
  })
);

export const projectRole = pgTable("ProjectRole", {
  id: text().primaryKey().$defaultFn(cuid),
  // project_manager, product_owner, ...
  roleKey: text().unique().notNull(),
  name: text().notNull(),
  // leadership, product, design, engineering, quality, data, stakeholder
  category: text(),
});

export const projectMethodology = pgTable(
  "ProjectMethodology",
  {
    id: text().primaryKey().$defaultFn(cuid),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // agile, scrum, lean_ux, design_thinking, kanban
    methodologyKey: text().notNull(),
    // primary | secondary
    tier: text().default("secondary").notNull(),
    createdAt: timestamp(ts).defaultNow().notNull(),
    updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (t) => ({
    wsMethod: unique("ProjectMethodology_workspaceId_methodologyKey_key").on(
      t.workspaceId,
      t.methodologyKey
    ),
    byWsTier: index("ProjectMethodology_workspaceId_tier_idx").on(
      t.workspaceId,
      t.tier
    ),
  })
);

export const kpiDefinition = pgTable("KpiDefinition", {
  id: text().primaryKey().$defaultFn(cuid),
  // task_completion_rate, team_velocity, ...
  kpiKey: text().unique().notNull(),
  name: text().notNull(),
  description: text().notNull(),
  formula: text().notNull(),
  dataSource: text().notNull(),
  // daily | weekly | sprint | monthly
  frequency: text().notNull(),
});

export const projectKpi = pgTable(
  "ProjectKpi",
  {
    id: text().primaryKey().$defaultFn(cuid),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    kpiKey: text().notNull(),
    enabled: boolean().default(true).notNull(),
    target: doublePrecision(),
    alertThreshold: doublePrecision(),
    createdAt: timestamp(ts).defaultNow().notNull(),
    updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (t) => ({
    wsKpi: unique("ProjectKpi_workspaceId_kpiKey_key").on(
      t.workspaceId,
      t.kpiKey
    ),
    byWsEnabled: index("ProjectKpi_workspaceId_enabled_idx").on(
      t.workspaceId,
      t.enabled
    ),
  })
);

export const projectKpiSnapshot = pgTable(
  "ProjectKpiSnapshot",
  {
    id: text().primaryKey().$defaultFn(cuid),
    projectKpiId: text()
      .notNull()
      .references(() => projectKpi.id, { onDelete: "cascade" }),
    value: doublePrecision().notNull(),
    capturedAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    byKpiCaptured: index("ProjectKpiSnapshot_projectKpiId_capturedAt_idx").on(
      t.projectKpiId,
      t.capturedAt
    ),
  })
);

export const projectAiInsight = pgTable(
  "ProjectAiInsight",
  {
    id: text().primaryKey().$defaultFn(cuid),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // risk | recommendation | alert | action | metric | workload
    type: text().notNull(),
    // low | medium | high
    severity: text(),
    title: text().notNull(),
    detail: text().notNull(),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    byWsType: index("ProjectAiInsight_workspaceId_type_idx").on(
      t.workspaceId,
      t.type
    ),
    byCreated: index("ProjectAiInsight_createdAt_idx").on(t.createdAt),
  })
);

export const projectInvitation = pgTable(
  "ProjectInvitation",
  {
    id: text().primaryKey().$defaultFn(cuid),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    email: text().notNull(),
    projectRole: text(),
    // pending, accepted, revoked
    status: text().default("pending").notNull(),
    invitedById: text(),
    createdAt: timestamp(ts).defaultNow().notNull(),
    updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (t) => ({
    wsEmail: unique("ProjectInvitation_workspaceId_email_key").on(
      t.workspaceId,
      t.email
    ),
    byStatus: index("ProjectInvitation_status_idx").on(t.status),
  })
);

export const auditLog = pgTable(
  "AuditLog",
  {
    id: text().primaryKey().$defaultFn(cuid),
    workspaceId: text().references(() => workspace.id),
    actorId: text(),
    // smart_goal.update, member.remove, kpi.toggle, ...
    action: text().notNull(),
    // smart_goal | methodology | member | kpi | insight
    entity: text().notNull(),
    entityId: text(),
    before: text(),
    after: text(),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    byWsEntity: index("AuditLog_workspaceId_entity_idx").on(
      t.workspaceId,
      t.entity
    ),
    byCreated: index("AuditLog_createdAt_idx").on(t.createdAt),
  })
);

// ===== Project Tasks (Kanban) =====

export const projectTask = pgTable(
  "ProjectTask",
  {
    id: text().primaryKey().$defaultFn(cuid),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // User assigned (null = unassigned, available for self-assign)
    assigneeId: text().references(() => user.id, { onDelete: "set null" }),
    createdById: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text().notNull(),
    description: text(),
    // todo | doing | done
    status: text().default("todo").notNull(),
    // low | medium | high | urgent
    priority: text(),
    dueDate: timestamp(ts),
    tags: text().array().notNull().default([]),
    // Kanban column order
    order: integer().default(0).notNull(),
    // links task to a methodology phase
    phaseKey: text(),
    // links task to a methodology artifact
    artifactKey: text(),
    createdAt: timestamp(ts).defaultNow().notNull(),
    updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
    completedAt: timestamp(ts),
  },
  (t) => ({
    byWsStatus: index("ProjectTask_workspaceId_status_idx").on(
      t.workspaceId,
      t.status
    ),
    byWsAssignee: index("ProjectTask_workspaceId_assigneeId_idx").on(
      t.workspaceId,
      t.assigneeId
    ),
    byAssigneeStatus: index("ProjectTask_assigneeId_status_idx").on(
      t.assigneeId,
      t.status
    ),
  })
);

// ===== Notifications =====

export const notification = pgTable(
  "Notification",
  {
    id: text().primaryKey().$defaultFn(cuid),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // join_approved | task_assigned | invite_received | ... (client-mapped)
    type: text().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    data: jsonb().$type<unknown>(),
    readAt: timestamp(ts),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    byUserCreated: index("Notification_userId_createdAt_idx").on(
      t.userId,
      t.createdAt
    ),
  })
);

export const pushSubscription = pgTable(
  "PushSubscription",
  {
    id: text().primaryKey().$defaultFn(cuid),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text().unique().notNull(),
    userAgent: text(),
    createdAt: timestamp(ts).defaultNow().notNull(),
  },
  (t) => ({
    byUser: index("PushSubscription_userId_idx").on(t.userId),
  })
);

// ===== Project Phases & Artifacts =====

export const projectPhaseState = pgTable(
  "ProjectPhaseState",
  {
    id: text().primaryKey().$defaultFn(cuid),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // design_thinking | scrum | ...
    methodologyKey: text().notNull(),
    // section key (phase/roles/artifacts/steps/metrics)
    phaseKey: text().notNull(),
    // not_started | in_progress | done | skipped
    status: text().default("not_started").notNull(),
    startedAt: timestamp(ts),
    completedAt: timestamp(ts),
    notes: text(),
    createdAt: timestamp(ts).defaultNow().notNull(),
    updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (t) => ({
    wsMethodPhase: unique(
      "ProjectPhaseState_workspaceId_methodologyKey_phaseKey_key"
    ).on(t.workspaceId, t.methodologyKey, t.phaseKey),
    byWsMethod: index(
      "ProjectPhaseState_workspaceId_methodologyKey_idx"
    ).on(t.workspaceId, t.methodologyKey),
  })
);

export const projectArtifactState = pgTable(
  "ProjectArtifactState",
  {
    id: text().primaryKey().$defaultFn(cuid),
    workspaceId: text()
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    phaseId: text()
      .notNull()
      .references(() => projectPhaseState.id, { onDelete: "cascade" }),
    methodologyKey: text().notNull(),
    phaseKey: text().notNull(),
    artifactKey: text().notNull(),
    // pending | in_progress | done | skipped
    status: text().default("pending").notNull(),
    // leader can mark artifact as required
    mandatory: boolean().default(false).notNull(),
    // hide noise in visualization
    visible: boolean().default(true).notNull(),
    // user-filled content (mirror of KnowledgeResource)
    filledContent: text(),
    // link to KnowledgeResource created for this artifact
    knowledgeResourceId: text(),
    startedAt: timestamp(ts),
    completedAt: timestamp(ts),
    createdAt: timestamp(ts).defaultNow().notNull(),
    updatedAt: timestamp(ts).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (t) => ({
    wsArtifact: unique("ProjectArtifactState_workspaceId_artifactKey_key").on(
      t.workspaceId,
      t.artifactKey
    ),
    byWsPhase: index("ProjectArtifactState_workspaceId_phaseKey_idx").on(
      t.workspaceId,
      t.phaseKey
    ),
    byWsStatus: index("ProjectArtifactState_workspaceId_status_idx").on(
      t.workspaceId,
      t.status
    ),
  })
);

import { z } from "zod";
import { KPI_KEYS, METHODOLOGY_KEYS, PROJECT_ROLE_KEYS } from "../domain/catalog";

export const smartGoalSchema = z.object({
  title: z.string().min(2).max(140),
  specific: z.string().max(2000).nullable().default(null),
  measurable: z.string().max(2000).nullable().default(null),
  achievable: z.string().max(2000).nullable().default(null),
  relevant: z.string().max(2000).nullable().default(null),
  timeBound: z.string().max(2000).nullable().default(null),
});
export type SmartGoalInput = z.infer<typeof smartGoalSchema>;

export const methodologySchema = z.object({
  primary: z.enum(METHODOLOGY_KEYS as [string, ...string[]]).nullable(),
  secondary: z.array(z.enum(METHODOLOGY_KEYS as [string, ...string[]])).default([]),
});
export type MethodologyInput = z.infer<typeof methodologySchema>;

export const memberUpdateSchema = z.object({
  projectRole: z.enum(PROJECT_ROLE_KEYS as [string, ...string[]]).nullable().optional(),
  permissionRole: z.enum(["member", "leader", "admin"]).optional(),
  status: z.enum(["active", "invited", "inactive"]).optional(),
});
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;

export const inviteSchema = z.object({
  email: z.string().email().max(160),
  projectRole: z.enum(PROJECT_ROLE_KEYS as [string, ...string[]]).nullable().optional(),
});
export type InviteInput = z.infer<typeof inviteSchema>;

export const kpiConfigSchema = z
  .object({
    entries: z
      .array(
        z.object({
          kpiKey: z.string().min(1),
          enabled: z.boolean(),
          target: z.number().nullable().optional(),
          alertThreshold: z.number().nullable().optional(),
        })
      )
      .refine((arr) => arr.every((e) => KPI_KEYS.includes(e.kpiKey)), {
        message: "Uno de los KPIs no pertenece al catálogo.",
      }),
  })
  .refine(
    ({ entries }) =>
      entries.every((e) => {
        if (!e.enabled) return true;
        if (e.target == null || e.alertThreshold == null) return true;
        return e.target > e.alertThreshold;
      }),
    {
      message:
        "Para cada KPI activo, la Meta debe ser mayor que el Umbral de alerta.",
    }
  );
export type KpiConfigInput = z.infer<typeof kpiConfigSchema>;

/* -------------------------------------------------------------------------- */
/* Proposed AI actions                                                        */
/* -------------------------------------------------------------------------- */

const methodologyEnum = z.enum(METHODOLOGY_KEYS as [string, ...string[]]);
const kpiKeyEnum = z.enum(KPI_KEYS as [string, ...string[]]);
const roleEnum = z.enum(PROJECT_ROLE_KEYS as [string, ...string[]]);

const smartGoalActionSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("smart_goal"),
  label: z.string().min(1).max(160),
  rationale: z.string().max(280).default(""),
  confidence: z.number().min(0).max(100).default(0),
  goal: z
    .object({
      title: z.string().min(2).max(140).optional(),
      specific: z.string().max(2000).optional(),
      measurable: z.string().max(2000).optional(),
      achievable: z.string().max(2000).optional(),
      relevant: z.string().max(2000).optional(),
      timeBound: z.string().max(2000).optional(),
    })
    .refine((g) => Object.keys(g).length > 0, {
      message: "El parche SMART debe incluir al menos un campo.",
    }),
});

const methodologyActionSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("methodology"),
  label: z.string().min(1).max(160),
  rationale: z.string().max(280).default(""),
  confidence: z.number().min(0).max(100).default(0),
  addSecondary: z.array(methodologyEnum).default([]),
  removeSecondary: z.array(methodologyEnum).default([]),
});

const kpiActionSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("kpi"),
  label: z.string().min(1).max(160),
  rationale: z.string().max(280).default(""),
  confidence: z.number().min(0).max(100).default(0),
  kpiKey: kpiKeyEnum,
  kpiName: z.string().max(160).default(""),
  enabled: z.boolean(),
  target: z.number().nullable().optional(),
  alertThreshold: z.number().nullable().optional(),
});

const roleActionSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("role"),
  label: z.string().min(1).max(160),
  rationale: z.string().max(280).default(""),
  confidence: z.number().min(0).max(100).default(0),
  memberName: z.string().min(1).max(160),
  projectRole: roleEnum,
  roleName: z.string().max(160).default(""),
});

export const proposedActionSchema = z.discriminatedUnion("kind", [
  smartGoalActionSchema,
  methodologyActionSchema,
  kpiActionSchema,
  roleActionSchema,
]);
export type ProposedActionInput = z.infer<typeof proposedActionSchema>;

export const applyAiInsightsSchema = z.object({
  actions: z.array(proposedActionSchema).min(1, {
    message: "Selecciona al menos una acción para aplicar.",
  }),
});
export type ApplyAiInsightsInput = z.infer<typeof applyAiInsightsSchema>;

export const revertAiInsightsSchema = z.object({
  smartGoal: z
    .object({
      title: z.string().min(2).max(140),
      specific: z.string().max(2000).nullable(),
      measurable: z.string().max(2000).nullable(),
      achievable: z.string().max(2000).nullable(),
      relevant: z.string().max(2000).nullable(),
      timeBound: z.string().max(2000).nullable(),
    })
    .nullable(),
  methodologies: z.object({
    primary: methodologyEnum.nullable(),
    secondary: z.array(methodologyEnum).default([]),
  }),
  kpis: z.array(
    z.object({
      kpiKey: z.string().min(1),
      enabled: z.boolean(),
      target: z.number().nullable(),
      alertThreshold: z.number().nullable(),
    })
  ),
  members: z.array(
    z.object({
      memberId: z.string().min(1),
      projectRole: roleEnum.nullable(),
    })
  ),
});
export type RevertAiInsightsInput = z.infer<typeof revertAiInsightsSchema>;

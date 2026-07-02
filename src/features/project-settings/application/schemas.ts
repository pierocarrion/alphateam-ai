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

export const kpiConfigSchema = z.object({
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
});
export type KpiConfigInput = z.infer<typeof kpiConfigSchema>;

import type { InsightType, Severity } from "./catalog";

export interface SmartGoal {
  id: string;
  workspaceId: string;
  title: string;
  specific: string | null;
  measurable: string | null;
  achievable: string | null;
  relevant: string | null;
  timeBound: string | null;
  version: number;
  smartScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SmartGoalVersion {
  id: string;
  version: number;
  title: string;
  specific: string | null;
  measurable: string | null;
  achievable: string | null;
  relevant: string | null;
  timeBound: string | null;
  smartScore: number | null;
  changedById: string | null;
  changeNote: string | null;
  createdAt: string;
}

export interface ProjectMethodologySelection {
  id: string;
  methodologyKey: string;
  tier: "primary" | "secondary";
}

export interface ProjectMember {
  id: string;
  userId: string | null;
  name: string | null;
  email: string | null;
  photoUrl: string | null;
  projectRole: string | null;
  permissionRole: string;
  status: "active" | "invited" | "inactive";
  joinedAt: string;
}

export interface ProjectInvitation {
  id: string;
  email: string;
  projectRole: string | null;
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
}

export interface ProjectKpi {
  id: string;
  kpiKey: string;
  enabled: boolean;
  target: number | null;
  alertThreshold: number | null;
  snapshots: { value: number; capturedAt: string }[];
}

export interface ProjectAiInsight {
  id: string;
  type: InsightType;
  severity: Severity | null;
  title: string;
  detail: string;
  createdAt: string;
}

import type { SmartGoal, SmartGoalVersion } from "./entities";

export interface SaveSmartGoalInput {
  workspaceId: string;
  title: string;
  specific: string | null;
  measurable: string | null;
  achievable: string | null;
  relevant: string | null;
  timeBound: string | null;
  smartScore: number | null;
  changedById: string;
}

export interface ISmartGoalRepository {
  get(workspaceId: string): Promise<SmartGoal | null>;
  upsert(input: SaveSmartGoalInput): Promise<SmartGoal>;
  listVersions(workspaceId: string): Promise<SmartGoalVersion[]>;
  restoreVersion(workspaceId: string, version: number, changedById: string): Promise<SmartGoal>;
}

export interface SetMethodologyInput {
  workspaceId: string;
  primary: string | null;
  secondary: string[];
}

export interface IMethodologyRepository {
  list(workspaceId: string): Promise<{ id: string; methodologyKey: string; tier: "primary" | "secondary" }[]>;
  set(input: SetMethodologyInput): Promise<{ id: string; methodologyKey: string; tier: "primary" | "secondary" }[]>;
}

export interface AddMemberInput {
  workspaceId: string;
  userId?: string;
  name?: string;
  email?: string;
  projectRole?: string | null;
  photoUrl?: string | null;
  permissionRole?: string;
}

export interface UpdateMemberInput {
  projectRole?: string | null;
  permissionRole?: string;
  status?: "active" | "invited" | "inactive";
}

export interface IMemberRepository {
  list(workspaceId: string): Promise<import("./entities").ProjectMember[]>;
  listInvitations(workspaceId: string): Promise<import("./entities").ProjectInvitation[]>;
  add(input: AddMemberInput): Promise<import("./entities").ProjectMember>;
  update(memberId: string, input: UpdateMemberInput): Promise<import("./entities").ProjectMember>;
  remove(memberId: string): Promise<void>;
  countActiveLeaders(workspaceId: string): Promise<number>;
  emailExists(workspaceId: string, email: string, exceptMemberId?: string): Promise<boolean>;
  invite(
    workspaceId: string,
    email: string,
    projectRole: string | null,
    invitedById: string
  ): Promise<import("./entities").ProjectInvitation>;
  revokeInvitation(invitationId: string): Promise<void>;
}

export interface KpiConfigEntry {
  kpiKey: string;
  enabled: boolean;
  target?: number | null;
  alertThreshold?: number | null;
}

export interface IKpiRepository {
  list(workspaceId: string): Promise<import("./entities").ProjectKpi[]>;
  set(workspaceId: string, entries: KpiConfigEntry[]): Promise<import("./entities").ProjectKpi[]>;
  recordSnapshot(workspaceId: string, kpiKey: string, value: number): Promise<void>;
}

export interface IAiInsightRepository {
  list(workspaceId: string): Promise<import("./entities").ProjectAiInsight[]>;
  replace(
    workspaceId: string,
    insights: Array<{
      type: import("./catalog").InsightType;
      severity: import("./catalog").Severity | null;
      title: string;
      detail: string;
    }>
  ): Promise<import("./entities").ProjectAiInsight[]>;
}

export interface AuditEntry {
  workspaceId: string;
  actorId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

export interface IAuditRepository {
  record(entry: AuditEntry): Promise<void>;
}

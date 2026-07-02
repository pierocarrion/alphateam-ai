import { fetchJson } from "@/shared/lib/api";
import type {
  MethodologyDefinition,
  RoleDefinition,
  KpiCatalogItem,
} from "@/features/project-settings/domain/catalog";
import type {
  ProjectAiInsight,
  ProjectInvitation,
  ProjectKpi,
  ProjectMember,
  ProjectMethodologySelection,
  SmartGoal,
  SmartGoalVersion,
} from "@/features/project-settings/domain/entities";
import type {
  ProposedAction,
  AppliedAction,
  BeforeSnapshot,
} from "@/features/project-settings/domain/proposedActions";

export interface ProjectSettingsSnapshot {
  smartGoal: SmartGoal | null;
  methodologies: ProjectMethodologySelection[];
  members: ProjectMember[];
  invitations: ProjectInvitation[];
  kpis: ProjectKpi[];
  insights: ProjectAiInsight[];
  catalogs: {
    methodologies: MethodologyDefinition[];
    roles: RoleDefinition[];
    kpis: KpiCatalogItem[];
  };
}

export interface SmartAnalysis {
  score: number;
  checks: Array<{ dimension: "specific" | "measurable" | "achievable" | "relevant" | "timeBound"; ok: boolean; feedback: string }>;
  suggestions: string[];
  improvedDraft: {
    specific: string;
    measurable: string;
    achievable: string;
    relevant: string;
    timeBound: string;
  };
}

export interface AiInsightBundle {
  risks: ProjectAiInsight[];
  recommendations: ProjectAiInsight[];
  alerts: ProjectAiInsight[];
  actionPlan: string[];
  suggestedMetrics: string[];
  workloadDistribution: Array<{ role: string; suggestedShare: number; rationale: string }>;
  proposedActions: ProposedAction[];
}

export interface ApplyAiInsightsResult {
  applied: AppliedAction[];
  before: BeforeSnapshot;
}

const base = (workspaceId: string) => `/api/workspaces/${workspaceId}`;

export const projectSettingsApi = {
  getSettings(workspaceId: string) {
    return fetchJson<ProjectSettingsSnapshot>(`${base(workspaceId)}/settings`);
  },
  getSmartGoal(workspaceId: string) {
    return fetchJson<{ smartGoal: SmartGoal | null; versions: SmartGoalVersion[] }>(
      `${base(workspaceId)}/smart-goal`
    );
  },
  saveSmartGoal(workspaceId: string, body: Record<string, unknown>) {
    return fetchJson<{ smartGoal: SmartGoal }>(`${base(workspaceId)}/smart-goal`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  analyzeSmartGoal(workspaceId: string) {
    return fetchJson<{ analysis: SmartAnalysis }>(`${base(workspaceId)}/smart-goal/analyze`, {
      method: "POST",
    });
  },
  getMethodology(workspaceId: string) {
    return fetchJson<{ methodologies: ProjectMethodologySelection[] }>(`${base(workspaceId)}/methodology`);
  },
  setMethodology(workspaceId: string, body: { primary: string | null; secondary: string[] }) {
    return fetchJson<{ methodologies: ProjectMethodologySelection[] }>(`${base(workspaceId)}/methodology`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  getMembers(workspaceId: string) {
    return fetchJson<{ members: ProjectMember[]; invitations: ProjectInvitation[] }>(
      `${base(workspaceId)}/members`
    );
  },
  invite(workspaceId: string, body: { email: string; projectRole: string | null }) {
    return fetchJson<{ invitation: ProjectInvitation }>(`${base(workspaceId)}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  updateMember(
    workspaceId: string,
    memberId: string,
    body: Record<string, unknown>
  ) {
    return fetchJson<{ member: ProjectMember }>(`${base(workspaceId)}/members/${memberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  removeMember(workspaceId: string, memberId: string) {
    return fetchJson<{ ok: true }>(`${base(workspaceId)}/members/${memberId}`, {
      method: "DELETE",
    });
  },
  getKpis(workspaceId: string) {
    return fetchJson<{ kpis: ProjectKpi[] }>(`${base(workspaceId)}/kpis`);
  },
  setKpis(workspaceId: string, entries: Array<Record<string, unknown>>) {
    return fetchJson<{ kpis: ProjectKpi[] }>(`${base(workspaceId)}/kpis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
  },
  getInsights(workspaceId: string) {
    return fetchJson<{ insights: ProjectAiInsight[] }>(`${base(workspaceId)}/ai-insights`);
  },
  regenerateInsights(workspaceId: string) {
    return fetchJson<{ bundle: AiInsightBundle; insights: ProjectAiInsight[] }>(
      `${base(workspaceId)}/ai-insights`,
      { method: "POST" }
    );
  },
  applyInsights(workspaceId: string, actions: ProposedAction[]) {
    return fetchJson<ApplyAiInsightsResult>(`${base(workspaceId)}/ai-insights/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actions }),
    });
  },
  revertInsights(workspaceId: string, before: BeforeSnapshot) {
    return fetchJson<{ reverted: string[] }>(`${base(workspaceId)}/ai-insights/revert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(before),
    });
  },
};

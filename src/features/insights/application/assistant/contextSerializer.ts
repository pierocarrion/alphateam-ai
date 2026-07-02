import type { TeamOverview } from "../../domain/entities/TeamOverview";
import type { EmployeeWithMetrics } from "../../domain/entities/Employee";
import type { WorkloadPoint } from "../../domain/entities/Workload";
import type { TeamAlert } from "../../domain/entities/Alert";
import type { TeamInsight } from "../../domain/entities/Insight";
import type { SkillGap } from "../../domain/entities/Learning";

/**
 * Serializes the live {@link TeamOverview} into a compact, deterministic text
 * block that grounds the AI Team Insights Assistant.
 *
 * Design goals:
 *   - The assistant must reason ONLY over what is visible on the dashboard
 *     (no invented facts). This serializer is the single source of truth for
 *     "what the model is allowed to see".
 *   - Output is compact (tokens are expensive) but complete enough to interpret
 *     relations between metrics (e.g. low risk + low participation).
 *   - Pure & synchronous so it is trivially unit-testable.
 */
export function serializeTeamOverview(overview: TeamOverview): string {
  const lines: string[] = [];
  const push = (s = "") => lines.push(s);

  push(`# TEAM CONTEXT`);
  push(`teamName: ${overview.teamName}`);
  push(`headcount: ${overview.headcount}`);
  push(`windowDays: ${overview.growth.points.length || 0} data points`);

  serializeWorkload(overview.workload.points, overview.workload, push);
  serializeSafety(overview, push);
  serializeRisk(overview, push);
  serializeGrowth(overview, push);
  serializeLearning(overview, push);
  serializeSkills(overview.skillGaps, push);
  serializeAlerts(overview.alerts, push);
  serializeInsights(overview.insights, push);
  serializeMembers(overview.members, push);

  return lines.join("\n");
}

function serializeWorkload(
  points: WorkloadPoint[],
  balance: TeamOverview["workload"],
  push: (s?: string) => void
) {
  push("");
  push(`## WORKLOAD BALANCE`);
  push(`averageOccupationPct: ${round(balance.averageOccupationPct)}`);
  push(`teamCapacityHours: ${round(balance.teamCapacityHours)}`);
  push(`teamWorkedHours: ${round(balance.teamWorkedHours)}`);
  push(`overloadedCount: ${balance.overloadedCount}`);
  if (points.length === 0) {
    push(`members: (none)`);
    return;
  }
  push(`members:`);
  for (const p of points) {
    push(
      `  - ${p.name}: occupationPct=${round(p.occupationPct)} status=${p.status}` +
        ` tasks=${p.totalTasks} estimatedHours=${round(p.estimatedHours)}` +
        ` workedHours=${round(p.workedHours)} availableHours=${round(p.availableHours)}` +
        ` overload=${p.overload ? "yes" : "no"}`
    );
  }
}

function serializeSafety(
  overview: TeamOverview,
  push: (s?: string) => void
) {
  const s = overview.psychologicalSafety;
  push("");
  push(`## PSYCHOLOGICAL SAFETY`);
  push(`score: ${round(s.score)}`);
  push(`status: ${s.status}`);
  push(`hasData: ${s.hasData ? "true" : "false"}`);
  push(
    `breakdown: survey=${round(s.breakdown.survey)} feedback=${round(
      s.breakdown.feedback
    )} participation=${round(s.breakdown.participation)} sentiment=${round(
      s.breakdown.sentiment
    )}`
  );
  if (s.trend.length > 0) {
    const last = s.trend[s.trend.length - 1];
    const first = s.trend[0];
    push(
      `trend: first=${round(first.score)} last=${round(
        last.score
      )} points=${s.trend.length} (lastDate=${last.date})`
    );
  } else {
    push(`trend: (empty)`);
  }
}

function serializeRisk(overview: TeamOverview, push: (s?: string) => void) {
  const r = overview.productivityRisk;
  push("");
  push(`## PRODUCTIVITY RISK`);
  push(`score: ${round(r.score)}`);
  push(`level: ${r.level}`);
  const b = r.breakdown;
  push(
    `breakdown: overload=${round(b.overload)} overdue=${round(
      b.overdue
    )} activityDecline=${round(b.activityDecline)} lowParticipation=${round(
      b.lowParticipation
    )} taskMiss=${round(b.taskMiss)} absenteeism=${round(b.absenteeism)}`
  );
  if (r.trend.length > 0) {
    const last = r.trend[r.trend.length - 1];
    const first = r.trend[0];
    push(
      `trend: first=${round(first.score)} last=${round(
        last.score
      )} points=${r.trend.length}`
    );
  } else {
    push(`trend: (empty)`);
  }
}

function serializeGrowth(overview: TeamOverview, push: (s?: string) => void) {
  const g = overview.growth;
  push("");
  push(`## TEAM GROWTH`);
  push(`granularity: ${g.granularity}`);
  push(`current: ${round(g.current)}`);
  push(`previous: ${round(g.previous)}`);
  push(`deltaPct: ${round(g.deltaPct)}`);
  if (g.points.length > 0) {
    push(`recentPoints (last 5):`);
    const slice = g.points.slice(-5);
    for (const p of slice) {
      push(
        `  - ${p.date}: growthIndex=${round(p.growthIndex)} courses=${p.coursesCompleted}` +
          ` newSkills=${p.newSkills} certifications=${p.certifications}` +
          ` sustainableProductivity=${round(p.sustainableProductivity)}` +
          ` participation=${round(p.participation)}`
      );
    }
  } else {
    push(`recentPoints: (empty)`);
  }
}

function serializeLearning(
  overview: TeamOverview,
  push: (s?: string) => void
) {
  const k = overview.learningKpis;
  push("");
  push(`## LEARNING PROGRESS`);
  push(`coursesStarted: ${k.coursesStarted}`);
  push(`coursesCompleted: ${k.coursesCompleted}`);
  push(`learningHours: ${round(k.learningHours)}`);
  push(`certifications: ${k.certifications}`);
}

function serializeSkills(gaps: SkillGap[], push: (s?: string) => void) {
  push("");
  push(`## SKILL MATRIX`);
  if (gaps.length === 0) {
    push(`skillGaps: (none)`);
    return;
  }
  push(`skillGaps:`);
  for (const g of gaps) {
    push(
      `  - ${g.skill}: holders=${g.holders} experts=${g.experts} riskLevel=${g.riskLevel}` +
        ` recommendation="${g.recommendation}"`
    );
  }
}

function serializeAlerts(alerts: TeamAlert[], push: (s?: string) => void) {
  push("");
  push(`## SMART ALERTS`);
  if (alerts.length === 0) {
    push(`alerts: (none)`);
    return;
  }
  push(`alerts:`);
  for (const a of alerts) {
    push(
      `  - [${a.severity}] ${a.type}` +
        (a.employeeName ? ` · ${a.employeeName}` : "") +
        `: ${a.message}` +
        (a.value != null ? ` (value=${round(a.value)})` : "") +
        (a.threshold != null ? ` (threshold=${round(a.threshold)})` : "")
    );
  }
}

function serializeInsights(
  insights: TeamInsight[],
  push: (s?: string) => void
) {
  push("");
  push(`## INSIGHTS`);
  if (insights.length === 0) {
    push(`insights: (none)`);
    return;
  }
  push(`insights:`);
  for (const i of insights) {
    push(
      `  - [${i.tone}] ${i.category}: ${i.title} — ${i.detail}`
    );
  }
}

function serializeMembers(
  members: EmployeeWithMetrics[],
  push: (s?: string) => void
) {
  push("");
  push(`## MEMBERS`);
  if (members.length === 0) {
    push(`members: (none)`);
    return;
  }
  push(`members:`);
  for (const m of members) {
    push(
      `  - ${m.name}` +
        (m.position ? ` · position=${m.position}` : "") +
        (m.seniority ? ` · seniority=${m.seniority}` : "") +
        `: activeTasks=${m.activeTasks} completedTasks=${m.completedTasks}` +
        ` workedHours=${round(m.workedHours)} estimatedHours=${round(
          m.estimatedHours
        )}` +
        ` progressPct=${round(m.progressPct)}` +
        ` learningProgress=${round(m.learningProgress)}` +
        ` sentiment=${m.sentiment} (score=${round(m.sentimentScore)}, hasData=${
          m.sentimentHasData ? "yes" : "no"
        })`
    );
  }
}

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

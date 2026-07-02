import { describe, it, expect } from "vitest";
import { serializeTeamOverview } from "./contextSerializer";
import type { TeamOverview } from "../../domain/entities/TeamOverview";
import type { EmployeeWithMetrics } from "../../domain/entities/Employee";

function baseOverview(overrides: Partial<TeamOverview> = {}): TeamOverview {
  return {
    teamName: "Acme",
    headcount: 1,
    workload: {
      points: [],
      averageOccupationPct: 0,
      teamCapacityHours: 0,
      teamWorkedHours: 0,
      overloadedCount: 0,
    },
    psychologicalSafety: {
      score: 0,
      status: "critical",
      hasData: false,
      trend: [],
      breakdown: { survey: 0, feedback: 0, participation: 0, sentiment: 0 },
    },
    productivityRisk: {
      score: 0,
      level: "low",
      trend: [],
      breakdown: {
        overload: 0,
        overdue: 0,
        activityDecline: 0,
        lowParticipation: 0,
        taskMiss: 0,
        absenteeism: 0,
      },
    },
    growth: {
      granularity: "month",
      points: [],
      current: 0,
      previous: 0,
      deltaPct: 0,
    },
    learningKpis: {
      coursesStarted: 0,
      coursesCompleted: 0,
      learningHours: 0,
      certifications: 0,
    },
    skillsMatrix: [],
    skillGaps: [],
    alerts: [],
    insights: [],
    members: [],
    ...overrides,
  };
}

describe("serializeTeamOverview", () => {
  it("always emits the team context header with name and headcount", () => {
    const out = serializeTeamOverview(baseOverview({ teamName: "A", headcount: 3 }));
    expect(out).toContain("# TEAM CONTEXT");
    expect(out).toContain("teamName: A");
    expect(out).toContain("headcount: 3");
  });

  it("exposes every dashboard section so the model can interpret relations", () => {
    const out = serializeTeamOverview(baseOverview());
    for (const section of [
      "## WORKLOAD BALANCE",
      "## PSYCHOLOGICAL SAFETY",
      "## PRODUCTIVITY RISK",
      "## TEAM GROWTH",
      "## LEARNING PROGRESS",
      "## SKILL MATRIX",
      "## SMART ALERTS",
      "## INSIGHTS",
      "## MEMBERS",
    ]) {
      expect(out).toContain(section);
    }
  });

  it("flags missing safety data so the model can be honest about it", () => {
    const out = serializeTeamOverview(
      baseOverview({
        psychologicalSafety: {
          score: 0,
          status: "critical",
          hasData: false,
          trend: [],
          breakdown: { survey: 0, feedback: 0, participation: 0, sentiment: 0 },
        },
      })
    );
    expect(out).toContain("hasData: false");
  });

  it("renders each member's metrics line", () => {
    const member: EmployeeWithMetrics = {
      id: "u1",
      name: "Maya",
      photo: null,
      position: "Designer",
      team: "t",
      role: "member",
      seniority: "mid",
      hireDate: null,
      employeeId: "u1",
      activeTasks: 3,
      completedTasks: 7,
      workedHours: 12.5,
      estimatedHours: 20,
      progressPct: 62,
      learningProgress: 40,
      sentimentScore: 80,
      sentiment: "positive",
      sentimentHasData: true,
    };
    const out = serializeTeamOverview(baseOverview({ headcount: 1, members: [member] }));
    expect(out).toContain("- Maya · position=Designer · seniority=mid");
    expect(out).toContain("activeTasks=3");
    expect(out).toContain("completedTasks=7");
    expect(out).toContain("sentiment=positive");
  });

  it("includes alert severity and message", () => {
    const out = serializeTeamOverview(
      baseOverview({
        alerts: [
          {
            id: "a1",
            severity: "critical",
            type: "overload",
            employeeId: null,
            employeeName: "Theo",
            message: "Sobrecarga crítica",
            createdAt: "2025-01-01",
          },
        ],
      })
    );
    expect(out).toContain("[critical] overload · Theo: Sobrecarga crítica");
  });

  it("shows '(none)' markers when sections are empty (so the model never invents)", () => {
    const out = serializeTeamOverview(baseOverview());
    expect(out).toContain("members: (none)");
    expect(out).toContain("alerts: (none)");
    expect(out).toContain("insights: (none)");
    expect(out).toContain("skillGaps: (none)");
  });
});

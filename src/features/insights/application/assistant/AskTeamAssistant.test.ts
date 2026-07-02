import { describe, it, expect } from "vitest";
import {
  AskTeamAssistant,
  normalizeAnswer,
  EMPTY_DASHBOARD_GUIDANCE,
  type AssistantAnswer,
} from "./AskTeamAssistant";
import type { TeamOverview } from "../../domain/entities/TeamOverview";
import type { AiClient } from "@/server/lib/ai/client";

function makeFakeAi(
  enabled: boolean,
  data: Partial<AssistantAnswer> | null,
  friendlyError?: string
): AiClient {
  return {
    providerName: "fake",
    provider: {
      name: "fake",
      model: "fake-1",
      isEnabled: () => enabled,
      chat: async () => ({
        ok: true,
        data: JSON.stringify(data),
        model: "fake-1",
        provider: "fake",
      }),
      chatJSON: async () =>
        data === null
          ? {
              ok: false,
              error: "boom",
              friendlyError,
              model: "fake-1",
              provider: "fake",
            }
          : { ok: true, data, model: "fake-1", provider: "fake" },
      embed: async () => ({ ok: false, error: "noop", model: "fake", provider: "fake" }),
    },
    embedder: {
      name: "fake",
      model: "fake",
      isEnabled: () => true,
      embed: async () => ({ ok: false, error: "noop", model: "fake", provider: "fake" }),
    },
  };
}

function fullOverview(): TeamOverview {
  return {
    teamName: "Acme",
    headcount: 2,
    workload: {
      points: [],
      averageOccupationPct: 60,
      teamCapacityHours: 800,
      teamWorkedHours: 480,
      overloadedCount: 0,
    },
    psychologicalSafety: {
      score: 72,
      status: "healthy",
      hasData: true,
      trend: [],
      breakdown: { survey: 70, feedback: 75, participation: 30, sentiment: 80 },
    },
    productivityRisk: {
      score: 28,
      level: "low",
      trend: [],
      breakdown: {
        overload: 0,
        overdue: 0,
        activityDecline: 5,
        lowParticipation: 60,
        taskMiss: 0,
        absenteeism: 0,
      },
    },
    growth: {
      granularity: "month",
      points: [],
      current: 80,
      previous: 70,
      deltaPct: 14.2,
    },
    learningKpis: {
      coursesStarted: 4,
      coursesCompleted: 2,
      learningHours: 12,
      certifications: 0,
    },
    skillsMatrix: [],
    skillGaps: [],
    alerts: [],
    insights: [],
    members: [],
  };
}

describe("AskTeamAssistant", () => {
  it("returns empty-dashboard guidance without calling the model when headcount is 0", async () => {
    let calls = 0;
    const ai = makeFakeAi(true, null);
    ai.provider.chatJSON = async () => {
      calls++;
      return { ok: true, data: null, model: "fake", provider: "fake" };
    };
    const useCase = new AskTeamAssistant(ai);
    const empty = { ...fullOverview(), headcount: 0 };

    const res = await useCase.execute({ question: "anything" }, empty);

    expect(calls).toBe(0);
    expect(res.usedAi).toBe(false);
    expect(res.reply).toBe(EMPTY_DASHBOARD_GUIDANCE.reply);
  });

  it("localizes the empty-dashboard guidance when locale=es", async () => {
    const ai = makeFakeAi(true, null);
    const useCase = new AskTeamAssistant(ai);
    const empty = { ...fullOverview(), headcount: 0 };

    const res = await useCase.execute({ question: "x", locale: "es" }, empty);

    expect(res.reply).toContain("recolectando datos");
    expect(res.recommendedActions.length).toBeGreaterThan(0);
  });

  it("returns a graceful fallback when the AI provider is disabled", async () => {
    const ai = makeFakeAi(false, null);
    const useCase = new AskTeamAssistant(ai);

    const res = await useCase.execute({ question: "Summarize" }, fullOverview());

    expect(res.usedAi).toBe(false);
    expect(res.confidence).toBe("Low");
    expect(res.reply).toMatch(/AI isn't enabled/i);
  });

  it("returns a graceful fallback when the provider errors", async () => {
    const ai = makeFakeAi(true, null, "AI is warming up.");
    const useCase = new AskTeamAssistant(ai);

    const res = await useCase.execute({ question: "Hi" }, fullOverview());

    expect(res.usedAi).toBe(false);
    expect(res.reply).toBe("AI is warming up.");
  });

  it("returns the structured answer when the provider succeeds", async () => {
    const ai = makeFakeAi(true, {
      reply: "**All good.**",
      confidence: "High",
      confidenceReason: "Workload is balanced.",
      recommendedActions: ["Schedule a 1:1 with Brandon."],
      evidence: ["avg occupation = 60%"],
    });
    const useCase = new AskTeamAssistant(ai);

    const res = await useCase.execute({ question: "Is my team healthy?" }, fullOverview());

    expect(res.usedAi).toBe(true);
    expect(res.reply).toBe("**All good.**");
    expect(res.confidence).toBe("High");
    expect(res.confidenceReason).toBe("Workload is balanced.");
    expect(res.recommendedActions).toEqual(["Schedule a 1:1 with Brandon."]);
    expect(res.evidence).toEqual(["avg occupation = 60%"]);
  });
});

describe("normalizeAnswer", () => {
  it("clamps invalid confidence to Medium", () => {
    expect(normalizeAnswer({ reply: "hi", confidence: "Banana" }).confidence).toBe("Medium");
  });

  it("filters blanks and caps recommendedActions to 5", () => {
    const out = normalizeAnswer({
      reply: "x",
      recommendedActions: ["a", "  ", "b", "c", "d", "e", "f"],
    });
    expect(out.recommendedActions).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("falls back to a safe reply when missing", () => {
    expect(normalizeAnswer({}).reply).toMatch(/couldn't shape/i);
  });
});

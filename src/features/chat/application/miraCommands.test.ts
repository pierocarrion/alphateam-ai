import { describe, expect, it } from "vitest";
import {
  MiraCommandRouter,
  parseMiraCommand,
  formatConversation,
  type MiraCommandContext,
} from "./miraCommands";
import type { AiClient } from "@/server/lib/ai/client";

function makeFakeAi(enabled: boolean, reply: string): AiClient {
  return {
    providerName: "fake",
    provider: {
      name: "fake",
      model: "fake-1",
      isEnabled: () => enabled,
      chat: async (req) => {
        // Echo back so tests can assert the prompt was shaped correctly.
        const last = req.messages[req.messages.length - 1]?.content ?? "";
        return { ok: true, data: enabled ? `${reply}::${last.slice(0, 12)}` : reply, model: "fake-1", provider: "fake" };
      },
      chatJSON: async () => ({ ok: false, error: "noop", model: "fake-1", provider: "fake" }),
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

const baseCtx: MiraCommandContext = {
  workspaceId: "w1",
  channelId: "c1",
  projectName: "Acme",
  conversation: [
    { author: "Maya", text: "Let's ship the deck by Friday." },
    { author: "Theo", text: "I'm blocked on the design assets." },
  ],
};

describe("parseMiraCommand", () => {
  it("detects summary in EN and ES", () => {
    expect(parseMiraCommand("@mira resume esta conversación").command).toBe("summary");
    expect(parseMiraCommand("@mira summarize").command).toBe("summary");
    expect(parseMiraCommand("mira, dame un resumen de lo dicho").command).toBe("summary");
  });

  it("detects risks and tasks intents", () => {
    expect(parseMiraCommand("@mira identify risks").command).toBe("risks");
    expect(parseMiraCommand("@mira identifica riesgos").command).toBe("risks");
    expect(parseMiraCommand("@mira crea tareas pendientes").command).toBe("tasks");
    expect(parseMiraCommand("@mira action items").command).toBe("tasks");
  });

  it("detects fetch: with colon and argument", () => {
    const parsed = parseMiraCommand("@mira fetch: marketing strategy");
    expect(parsed.command).toBe("fetch");
    expect(parsed.argument).toBe("marketing strategy");
  });

  it("detects fetch with space form", () => {
    const parsed = parseMiraCommand("@mira fetch onboarding process");
    expect(parsed.command).toBe("fetch");
    expect(parsed.argument).toBe("onboarding process");
  });

  it("detects retrospective and strategy", () => {
    expect(parseMiraCommand("@mira genera una retrospectiva").command).toBe("retrospective");
    expect(parseMiraCommand("@mira crea una estrategia comercial").command).toBe("strategy");
  });

  it("falls back to general when no keyword matches", () => {
    expect(parseMiraCommand("@mira cómo vas?").command).toBe("general");
  });

  it("does not false-trigger on substrings like 'admirable'", () => {
    expect(parseMiraCommand("this is admirable work").command).toBe("general");
  });
});

describe("formatConversation", () => {
  it("formats authors and text", () => {
    expect(formatConversation(baseCtx.conversation)).toContain("Maya: Let's ship");
  });
  it("returns placeholder for empty", () => {
    expect(formatConversation([])).toBe("(empty conversation)");
  });
});

describe("MiraCommandRouter", () => {
  it("returns a graceful fallback when AI is disabled", async () => {
    const router = new MiraCommandRouter(makeFakeAi(false, "x"));
    const result = await router.run(parseMiraCommand("@mira resume"), baseCtx);
    expect(result.usedAi).toBe(false);
    expect(result.reply).toMatch(/AI isn't enabled|disabled/i);
  });

  it("calls the provider and returns its reply for summary", async () => {
    const router = new MiraCommandRouter(makeFakeAi(true, "OK"));
    const result = await router.run(parseMiraCommand("@mira resume"), baseCtx);
    expect(result.usedAi).toBe(true);
    expect(result.reply).toContain("OK");
    expect(result.structured?.bucket).toBe("summary");
  });

  it("fetch reports nothing indexed when knowledge is empty", async () => {
    const router = new MiraCommandRouter(makeFakeAi(true, "OK"));
    const result = await router.run(parseMiraCommand("@mira fetch: sales plan"), baseCtx);
    expect(result.command).toBe("fetch");
    expect(result.reply).toMatch(/nothing indexed|found nothing/i);
    expect(result.usedAi).toBe(false);
  });

  it("fetch returns raw snippets when AI is disabled but knowledge exists", async () => {
    const router = new MiraCommandRouter(makeFakeAi(false, "x"));
    const result = await router.run(parseMiraCommand("@mira fetch: sales"), {
      ...baseCtx,
      knowledge: [{ title: "Sales Playbook", snippet: "Qualify by pain" }],
    });
    expect(result.reply).toContain("Sales Playbook");
    expect(result.usedAi).toBe(false);
  });

  it("fetch synthesizes a grounded answer when AI is enabled and knowledge exists", async () => {
    const router = new MiraCommandRouter(makeFakeAi(true, "SYNTH"));
    const result = await router.run(parseMiraCommand("@mira fetch: sales"), {
      ...baseCtx,
      knowledge: [{ title: "Sales Playbook", snippet: "Qualify by pain" }],
    });
    expect(result.usedAi).toBe(true);
    expect(result.reply).toContain("SYNTH");
    expect(result.structured?.topic).toBe("sales");
  });
});

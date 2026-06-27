import { describe, expect, it } from "vitest";
import {
  phaseKeyFromSection,
  getMethodologyPhases,
  getMethodologyVisualization,
} from "../domain/visualization";

describe("phaseKeyFromSection", () => {
  it("normalizes titles with accents and punctuation", () => {
    expect(phaseKeyFromSection("Fase 1 — Empatizar", 1)).toBe("fase_1_empatizar");
    expect(phaseKeyFromSection("Paso 3 — Scrum Diario (15 min)", 5)).toBe(
      "paso_3_scrum_diario_15_min"
    );
    expect(phaseKeyFromSection("Roles", 1)).toBe("roles");
  });

  it("falls back to section_<order> for empty/garbage titles", () => {
    expect(phaseKeyFromSection("!!!", 7)).toBe("section_7");
  });

  it("produces stable keys (idempotent)", () => {
    const a = phaseKeyFromSection("Fase 2 — Definir", 2);
    const b = phaseKeyFromSection("Fase 2 — Definir", 2);
    expect(a).toBe(b);
  });
});

describe("getMethodologyVisualization", () => {
  it("maps design_thinking to linear", () => {
    expect(getMethodologyVisualization("design_thinking")).toBe("linear");
  });

  it("maps scrum to cyclic", () => {
    expect(getMethodologyVisualization("scrum")).toBe("cyclic");
  });

  it("defaults unknown methodologies to linear", () => {
    expect(getMethodologyVisualization("unknown")).toBe("linear");
  });
});

describe("getMethodologyPhases", () => {
  it("returns the 5 phases of Design Thinking in order", () => {
    const phases = getMethodologyPhases("design_thinking");
    expect(phases).toHaveLength(5);
    expect(phases.map((p) => p.order)).toEqual([1, 2, 3, 4, 5]);
    expect(phases[0].title).toContain("Empatizar");
    expect(phases[4].title).toContain("Probar");
  });

  it("returns sections of Scrum including roles, artifacts, steps and metrics", () => {
    const phases = getMethodologyPhases("scrum");
    const kinds = new Set(phases.map((p) => p.kind));
    expect(kinds.has("roles")).toBe(true);
    expect(kinds.has("artifacts")).toBe(true);
    expect(kinds.has("steps")).toBe(true);
    expect(kinds.has("metrics")).toBe(true);
  });

  it("exposes items with stable artifact keys", () => {
    const phases = getMethodologyPhases("design_thinking");
    const empathy = phases[0].items.find((i) => i.key === "empathy_map");
    expect(empathy).toBeDefined();
    expect(empathy?.prompts).toContain("¿Qué piensa y siente?");
  });

  it("returns empty for unknown methodologies", () => {
    expect(getMethodologyPhases("does_not_exist")).toEqual([]);
  });
});

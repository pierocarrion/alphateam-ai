import { describe, expect, it } from "vitest";
import {
  SMART_DIMENSIONS,
  computeSmartScore,
  validateSmart,
} from "./smart";
import {
  isLeadershipRole,
  KPI_KEYS,
  METHODOLOGY_KEYS,
  PROJECT_ROLE_KEYS,
  roleName,
} from "../domain/catalog";

describe("computeSmartScore", () => {
  it("returns 0 when nothing is filled", () => {
    expect(computeSmartScore({})).toBe(0);
  });

  it("scores 20 points per filled dimension (minimum 8 chars)", () => {
    expect(computeSmartScore({ specific: "short" })).toBe(0);
    expect(computeSmartScore({ specific: "A very specific objective" })).toBe(20);
    expect(
      computeSmartScore({
        specific: "A very specific objective",
        measurable: "With a clear metric value",
      })
    ).toBe(40);
  });

  it("reaches 100 when every dimension is richly filled", () => {
    const full = Object.fromEntries(
      SMART_DIMENSIONS.map((d) => [d, "This is a rich description"])
    ) as Record<(typeof SMART_DIMENSIONS)[number], string>;
    expect(computeSmartScore(full)).toBe(100);
  });
});

describe("validateSmart", () => {
  it("flags dimensions shorter than 8 chars as not ok", () => {
    const checks = validateSmart({ specific: "x", measurable: "" } as never);
    expect(checks.every((c) => !c.ok)).toBe(true);
    expect(checks).toHaveLength(SMART_DIMENSIONS.length);
  });
});

describe("catalog", () => {
  it("has exactly 5 methodologies", () => {
    expect(METHODOLOGY_KEYS).toEqual([
      "agile",
      "scrum",
      "lean_ux",
      "design_thinking",
      "kanban",
    ]);
  });

  it("marks only leadership roles as leadership", () => {
    expect(isLeadershipRole("project_manager")).toBe(true);
    expect(isLeadershipRole("ux_designer")).toBe(false);
    expect(isLeadershipRole(null)).toBe(false);
    expect(isLeadershipRole("unknown")).toBe(false);
  });

  it("resolves a friendly role name", () => {
    expect(roleName("product_owner")).toBe("Product Owner");
    expect(roleName(null)).toBe("Sin rol");
  });

  it("has 11 KPI keys with stable identifiers", () => {
    expect(KPI_KEYS).toContain("task_completion_rate");
    expect(KPI_KEYS).toHaveLength(11);
  });

  it("has 12 project role keys", () => {
    expect(PROJECT_ROLE_KEYS).toHaveLength(12);
  });
});

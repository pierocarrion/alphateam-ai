import { describe, expect, it } from "vitest";
import { analyzeImageWithGemini, toFriendlyGeminiError } from "./gemini";

describe("toFriendlyGeminiError", () => {
  it("maps quota errors to a friendly message", () => {
    expect(toFriendlyGeminiError("Resource has been exhausted (e.g. check quota)")).toMatch(/AI limit/i);
    expect(toFriendlyGeminiError("429 Too Many Requests")).toMatch(/AI limit/i);
    expect(toFriendlyGeminiError("RATE_LIMIT exceeded")).toMatch(/AI limit/i);
  });

  it("maps permission/auth errors to a friendly message", () => {
    expect(toFriendlyGeminiError("7 PERMISSION_DENIED: Permission denied on resource project")).toMatch(/isn't reachable/i);
    expect(toFriendlyGeminiError("UNAUTHENTICATED: 401")).toMatch(/isn't reachable/i);
    expect(toFriendlyGeminiError("403 Forbidden")).toMatch(/isn't reachable/i);
  });

  it("maps JSON parse errors to a friendly message", () => {
    expect(toFriendlyGeminiError("JSON parse error: Unexpected token < in JSON")).toMatch(/couldn't read/i);
    expect(toFriendlyGeminiError("Unexpected token < at position 0")).toMatch(/couldn't read/i);
  });

  it("maps empty response to a friendly message", () => {
    expect(toFriendlyGeminiError("Empty response from Gemini")).toMatch(/didn't respond/i);
  });

  it("maps disabled/misconfigured to a friendly message", () => {
    expect(toFriendlyGeminiError("Gemini not enabled or misconfigured")).toMatch(/aren't enabled/i);
  });

  it("maps timeout/unavailable to a friendly message", () => {
    expect(toFriendlyGeminiError("DEADLINE_EXCEEDED")).toMatch(/isn't reachable/i);
    expect(toFriendlyGeminiError("503 Service Unavailable")).toMatch(/isn't reachable/i);
    expect(toFriendlyGeminiError("timeout after 30000ms")).toMatch(/isn't reachable/i);
  });

  it("never leaks raw technical error strings", () => {
    const msg = toFriendlyGeminiError("7 PERMISSION_DENIED: Permission denied on resource project alpha-123");
    expect(msg).not.toContain("PERMISSION_DENIED");
    expect(msg).not.toContain("alpha-123");
    expect(msg).not.toContain("project");
  });

  it("returns a default friendly message for unknown errors", () => {
    expect(toFriendlyGeminiError("some unknown error")).toMatch(/couldn't process/i);
  });

  it("returns a default friendly message for undefined", () => {
    expect(toFriendlyGeminiError(undefined)).toMatch(/couldn't process/i);
  });
});

describe("analyzeImageWithGemini", () => {
  it("rejects unsupported MIME types without calling the model", async () => {
    const res = await analyzeImageWithGemini({
      image: Buffer.from("x"),
      mimeType: "application/pdf",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/unsupported image type/i);
  });

  it("returns ok:false (not a throw) when Gemini is disabled", async () => {
    // GEMINI_ENABLED is not "true" in the test environment, so the model is
    // unavailable. The ingest flow must be able to fall back to manual entry.
    const res = await analyzeImageWithGemini({
      image: Buffer.from("x"),
      mimeType: "image/png",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });
});

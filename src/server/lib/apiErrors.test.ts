import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  jsonError,
  parseRequestBody,
  toFriendlyMessage,
  errorStatus,
} from "./apiErrors";
import { UserFacingError } from "./errors";

// Synthetic DB error carrying a Prisma-style code. The error mapper keys off
// the `code` field matching /^P\d{3,4}$/ (see isPrismaKnown in apiErrors.ts),
// so no Prisma runtime dependency is required.
function prismaError(code: string): unknown {
  return Object.assign(new Error("raw db message"), { code });
}

describe("toFriendlyMessage", () => {
  it("passes UserFacingError messages through", () => {
    expect(toFriendlyMessage(new UserFacingError("custom friendly"))).toBe(
      "custom friendly"
    );
  });

  it("maps Zod errors to a friendly, non-technical message", () => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
    });
    const result = schema.safeParse({ email: "x", password: "1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = toFriendlyMessage(result.error);
      expect(msg).toBe("Please enter a valid email address.");
      expect(msg).not.toContain("Invalid");
      expect(msg).not.toContain("expected");
    }
  });

  it("maps Prisma P2021 (table missing) to a friendly message", () => {
    const msg = toFriendlyMessage(prismaError("P2021"));
    expect(msg).toMatch(/warming up|try again/i);
    expect(msg).not.toContain("prisma");
    expect(msg).not.toContain("User");
  });

  it("maps Prisma P2002 (unique) to a friendly message", () => {
    expect(toFriendlyMessage(prismaError("P2002"))).toMatch(/already taken/i);
  });

  it("maps Prisma P2025 (not found) to a friendly message", () => {
    expect(toFriendlyMessage(prismaError("P2025"))).toMatch(/couldn't find/i);
  });

  it("never leaks raw Error messages for unknown errors", () => {
    const msg = toFriendlyMessage(new Error("Invalid `prisma.user.findUnique()`"));
    expect(msg).toMatch(/something went wrong/i);
    expect(msg).not.toContain("prisma");
    expect(msg).not.toContain("findUnique");
  });

  it("maps SyntaxError (bad JSON) to a friendly message", () => {
    expect(toFriendlyMessage(new SyntaxError("Unexpected token"))).toBe(
      "Please send a valid request."
    );
  });
});

describe("errorStatus", () => {
  it("uses UserFacingError status", () => {
    expect(errorStatus(new UserFacingError("x", 418))).toBe(418);
  });

  it("returns 400 for Zod errors", () => {
    const schema = z.object({ email: z.string().email() });
    const result = schema.safeParse({ email: "x" });
    if (!result.success) expect(errorStatus(result.error)).toBe(400);
  });

  it("returns 409 for unique constraint violations", () => {
    expect(errorStatus(prismaError("P2002"))).toBe(409);
  });

  it("returns 500 for table-missing errors", () => {
    expect(errorStatus(prismaError("P2021"))).toBe(500);
  });

  it("returns 500 for unknown errors", () => {
    expect(errorStatus(new Error("boom"))).toBe(500);
  });
});

describe("jsonError", () => {
  it("returns a friendly JSON response and never leaks internals", async () => {
    const res = jsonError(prismaError("P2021"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/warming up|try again/i);
    expect(body.error).not.toContain("prisma");
  });
});

describe("parseRequestBody", () => {
  it("throws a UserFacingError for invalid JSON", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    await expect(parseRequestBody(request)).rejects.toThrow(
      /valid request/i
    );
  });

  it("returns parsed JSON for valid bodies", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
    await expect(parseRequestBody(request)).resolves.toEqual({ ok: true });
  });
});

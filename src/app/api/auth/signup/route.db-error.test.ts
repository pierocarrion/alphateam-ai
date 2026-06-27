import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockFindByEmail, mockCreate } = vi.hoisted(() => ({
  mockFindByEmail: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("@/server/lib/container", () => ({
  container: {
    userRepository: {
      findByEmail: mockFindByEmail,
      create: mockCreate,
    },
  },
}));

import { POST } from "./route";
import { createJsonRequest } from "@/tests/helpers/fetch";

describe("POST /api/auth/signup — database errors (P2021)", () => {
  beforeEach(() => {
    mockFindByEmail.mockReset();
    mockCreate.mockReset();
  });

  it("returns a friendly message when the User table is missing", async () => {
    mockFindByEmail.mockRejectedValueOnce(
      Object.assign(new Error("The table public.User does not exist"), {
        code: "P2021",
      })
    );

    const request = createJsonRequest(
      "http://localhost:3000/api/auth/signup",
      "POST",
      {
        email: "piero.january15@gmail.com",
        name: "Piero",
        password: "lissa123",
      }
    );

    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toMatch(/warming up|try again/i);
    expect(data.error).not.toContain("prisma");
    expect(data.error).not.toContain("User");
    expect(data.error).not.toContain("table");
    expect(data.error).not.toContain("findUnique");
  });

  it("returns a friendly message when the create fails with P2021", async () => {
    mockFindByEmail.mockResolvedValueOnce(null);
    mockCreate.mockRejectedValueOnce(
      Object.assign(new Error("The table public.User does not exist"), {
        code: "P2021",
      })
    );

    const request = createJsonRequest(
      "http://localhost:3000/api/auth/signup",
      "POST",
      {
        email: "piero.january15@gmail.com",
        name: "Piero",
        password: "lissa123",
      }
    );

    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toMatch(/warming up|try again/i);
    expect(data.error).not.toContain("prisma");
  });

  it("returns a friendly message when the database is unreachable (P1001)", async () => {
    mockFindByEmail.mockRejectedValueOnce(
      Object.assign(new Error("Can't reach database server"), {
        code: "P1001",
      })
    );

    const request = createJsonRequest(
      "http://localhost:3000/api/auth/signup",
      "POST",
      {
        email: "piero.january15@gmail.com",
        name: "Piero",
        password: "lissa123",
      }
    );

    const response = await POST(request);
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.error).toMatch(/trouble reaching|try again/i);
    expect(data.error).not.toContain("prisma");
    expect(data.error).not.toContain("database server");
  });
});

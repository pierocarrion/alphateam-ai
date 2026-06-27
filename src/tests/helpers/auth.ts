import { vi } from "vitest";
import { getServerSession } from "next-auth/next";
import { getTestDb } from "./db";
import { user as userTable, userProfile } from "@drizzle/schema";

const TEST_SECRET = "test-secret-must-be-at-least-32-characters-long";

export function getTestAuthSecret(): string {
  return TEST_SECRET;
}

export async function createTestSessionCookie(userId: string): Promise<string> {
  const { encode } = await import("next-auth/jwt");
  const token = await encode({
    secret: TEST_SECRET,
    token: { sub: userId },
    maxAge: 60 * 60 * 24 * 7,
  });
  return `next-auth.session-token=${token}`;
}

export async function createAuthenticatedRequest(
  userId: string,
  input: RequestInfo,
  init?: RequestInit
): Promise<Request> {
  const cookie = await createTestSessionCookie(userId);
  const headers = new Headers(init?.headers);
  const existingCookie = headers.get("cookie");
  headers.set(
    "cookie",
    existingCookie ? `${existingCookie}; ${cookie}` : cookie
  );
  return new Request(input, { ...init, headers });
}

export async function seedUserAndAuth(input?: {
  name?: string;
  email?: string;
  password?: string;
  onboarded?: boolean;
}) {
  const db = await getTestDb();
  const name = input?.name ?? "Test User";
  const email =
    input?.email?.toLowerCase() ??
    `test-${crypto.randomUUID()}@example.com`;
  const passwordHash = input?.password ?? "password123";

  const user = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(userTable)
      .values({ name, email, passwordHash })
      .returning();
    await tx.insert(userProfile).values({
      userId: u!.id,
      onboarded: input?.onboarded ?? false,
    });
    return u!;
  });

  const cookie = await createTestSessionCookie(user.id);

  return { user, email, password: passwordHash, cookie };
}

export async function mockSession(user: { id: string; email: string | null; name: string | null }) {
  const mocked = vi.mocked(getServerSession);
  mocked.mockReset();
  mocked.mockResolvedValue({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  } as Awaited<ReturnType<typeof getServerSession>>);
}

import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignUpUser, signUpUserSchema } from "@/features/auth/application/use-cases/SignUpUser";
import { container } from "@/server/lib/container";
import { isPrismaConnectionError } from "@/server/lib/auth";
import { db } from "@/server/lib/db";
import { account, user as userTable } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/shared/lib/logger";

const log = createLogger("auth");

const signUpUser = new SignUpUser(container.userRepository);

const GOOGLE_CALENDAR_SCOPE =
  "openid email profile https://www.googleapis.com/auth/calendar.readonly";

const LINK_COOKIE = "gc_link_uid";

function googleProvider() {
  return GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    allowDangerousEmailAccountLinking: true,
    authorization: {
      params: {
        prompt: "consent",
        access_type: "offline",
        response_type: "code",
        scope: GOOGLE_CALENDAR_SCOPE,
      },
    },
  });
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      name: { label: "Name", type: "text" },
      mode: { label: "Mode", type: "text" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      try {
        const email = credentials.email.toLowerCase().trim();
        const existing = await container.userRepository.findByEmail(email);

        if (credentials.mode === "signup") {
          if (existing) return null;
          const parsed = signUpUserSchema.safeParse({
            email: credentials.email,
            name: credentials.name || email.split("@")[0],
            password: credentials.password,
          });
          if (!parsed.success) return null;
          const user = await signUpUser.execute(parsed.data);
          return { id: user.id, email: user.email, name: user.name };
        }

        if (!existing) return null;
        const dbUser = await prismaUserWithPassword(email);
        if (dbUser?.blocked) return null;
        const valid = await bcrypt.compare(
          credentials.password,
          // PrismaUserRepository does not expose passwordHash; read directly
          dbUser?.passwordHash ?? ""
        );
        if (!valid) return null;
        return {
          id: existing.id,
          email: existing.email,
          name: existing.name,
          globalRole: dbUser?.globalRole ?? null,
        };
      } catch (error) {
        if (isPrismaConnectionError(error)) {
          log.error("service unavailable", error);
          return null;
        }
        log.error("authorize error", error);
        return null;
      }
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(googleProvider());
}

/**
 * Persists the Google OAuth tokens onto the user's Account row so the calendar
 * service can read (and refresh) them later.
 */
async function persistGoogleAccount(
  userId: string,
  accountArg: {
    type: string;
    provider: string;
    providerAccountId: string;
    refresh_token?: string | null;
    access_token?: string | null;
    expires_at?: number | null;
    token_type?: string | null;
    scope?: string | null;
    id_token?: string | null;
  },
  email: string
): Promise<void> {
  await db
    .insert(account)
    .values({
      userId,
      type: accountArg.type,
      provider: "google",
      providerAccountId: accountArg.providerAccountId,
      refresh_token: accountArg.refresh_token,
      access_token: accountArg.access_token,
      expires_at: accountArg.expires_at,
      token_type: accountArg.token_type,
      scope: accountArg.scope,
      id_token: accountArg.id_token,
    })
    .onConflictDoUpdate({
      target: [account.provider, account.providerAccountId],
      set: {
        userId,
        ...(accountArg.access_token !== undefined
          ? { access_token: accountArg.access_token }
          : {}),
        ...(accountArg.refresh_token
          ? { refresh_token: accountArg.refresh_token }
          : {}),
        ...(accountArg.expires_at !== undefined
          ? { expires_at: accountArg.expires_at }
          : {}),
        ...(accountArg.token_type !== undefined
          ? { token_type: accountArg.token_type }
          : {}),
        ...(accountArg.scope !== undefined ? { scope: accountArg.scope } : {}),
        ...(accountArg.id_token !== undefined
          ? { id_token: accountArg.id_token }
          : {}),
      },
    });

  // Keep the user email in sync with Google in case it differs.
  // Skip silently only when the email already belongs to another user
  // (unique constraint) — the link by id still holds.
  if (email) {
    try {
      const owner = await db.query.user.findFirst({
        where: eq(userTable.email, email),
        columns: { id: true },
      });
      if (!owner || owner.id === userId) {
        await db.update(userTable).set({ email }).where(eq(userTable.id, userId));
      } else {
        log.warn("skipping email sync: google email belongs to another user", {
          userId,
          email,
        });
      }
    } catch (error) {
      log.error("email sync failed (non-fatal)", error);
    }
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const email = String(profile?.email ?? user?.email ?? "")
          .toLowerCase()
          .trim();
        if (!email) return false;

        let targetUserId: string | undefined;

        // Prefer the explicit link cookie set by /api/calendar/connect — this
        // lets a signed-in user link a Google account even when the Google
        // email differs from their account email.
        try {
          const cookieStore = await cookies();
          const linkUid = cookieStore.get(LINK_COOKIE)?.value;
          if (linkUid) targetUserId = linkUid;
        } catch {
          /* cookies() unavailable in this context — fall back to email match */
        }

        if (!targetUserId) {
          const byEmail = await db.query.user.findFirst({
            where: eq(userTable.email, email),
            columns: { id: true },
          });
          targetUserId = byEmail?.id;
        }

        if (!targetUserId) {
          // Google login only links to existing accounts; onboarding stays on
          // the credentials signup flow.
          return "/login?error=OAuthEmailNotLinked";
        }

        try {
          await persistGoogleAccount(targetUserId, account, email);
        } catch (error) {
          if (isPrismaConnectionError(error)) {
            log.error("google link service unavailable", error);
          } else {
            log.error("google link error", error);
          }
        }

        try {
          const cookieStore = await cookies();
          cookieStore.delete(LINK_COOKIE);
        } catch {
          /* ignore */
        }

        // Make the JWT resolve to our DB user (requireUser looks up by email,
        // but keep sub consistent too).
        user.id = targetUserId;
        user.email = email;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.globalRole =
          (user as { globalRole?: string | null }).globalRole ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.sub && session.user) {
        (session.user as { id: string }).id = token.sub;
        (session.user as { globalRole?: string | null }).globalRole =
          token.globalRole ?? null;
      }
      return session;
    },
  },
};

async function prismaUserWithPassword(email: string) {
  return db.query.user.findFirst({
    where: eq(userTable.email, email),
    columns: { passwordHash: true, globalRole: true, blocked: true },
  });
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

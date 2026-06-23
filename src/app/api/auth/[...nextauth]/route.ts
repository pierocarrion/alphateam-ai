import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignUpUser, signUpUserSchema } from "@/features/auth/application/use-cases/SignUpUser";
import { container } from "@/server/lib/container";
import { isPrismaConnectionError } from "@/server/lib/auth";
import { prisma } from "@/server/lib/prisma";

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
        const valid = await bcrypt.compare(
          credentials.password,
          // PrismaUserRepository does not expose passwordHash; read directly
          (await prismaUserWithPassword(email))?.passwordHash ?? ""
        );
        if (!valid) return null;
        return { id: existing.id, email: existing.email, name: existing.name };
      } catch (error) {
        if (isPrismaConnectionError(error)) {
          console.error("[auth] service unavailable:", error);
          return null;
        }
        console.error("[auth] authorize error:", error);
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
  account: {
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
  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: account.providerAccountId,
      },
    },
    create: {
      userId,
      type: account.type,
      provider: "google",
      providerAccountId: account.providerAccountId,
      refresh_token: account.refresh_token,
      access_token: account.access_token,
      expires_at: account.expires_at,
      token_type: account.token_type,
      scope: account.scope,
      id_token: account.id_token,
    },
    update: {
      userId,
      access_token: account.access_token ?? undefined,
      ...(account.refresh_token ? { refresh_token: account.refresh_token } : {}),
      expires_at: account.expires_at ?? undefined,
      token_type: account.token_type ?? undefined,
      scope: account.scope ?? undefined,
      id_token: account.id_token ?? undefined,
    },
  });

  // Keep the user email in sync with Google in case it differs.
  await prisma.user.update({
    where: { id: userId },
    data: { email },
  }).catch(() => {
    /* email unique constraint mismatch is non-fatal for linking */
  });
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
          const byEmail = await prisma.user.findUnique({
            where: { email },
            select: { id: true },
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
            console.error("[auth] google link service unavailable:", error);
          } else {
            console.error("[auth] google link error:", error);
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
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.sub && session.user) {
        (session.user as { id: string }).id = token.sub;
      }
      return session;
    },
  },
};

async function prismaUserWithPassword(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { passwordHash: true },
  });
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

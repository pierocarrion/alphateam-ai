import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { SignUpUser, signUpUserSchema } from "@/features/auth/application/use-cases/SignUpUser";
import { container } from "@/server/lib/container";

const signUpUser = new SignUpUser(container.userRepository);

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
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
          console.error("[auth] authorize error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
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
  const { prisma } = await import("@/server/lib/prisma");
  return prisma.user.findUnique({
    where: { email },
    select: { passwordHash: true },
  });
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

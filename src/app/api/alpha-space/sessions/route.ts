import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import {
  alphaMessage,
  alphaSession,
  user as userTable,
  workspaceSubscription,
} from "@drizzle/schema";
import { eq, and, desc, count, gte, inArray } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import {
  FRAMEWORKS,
  getFramework,
  getWeeklyLimit,
  startOfWeek,
  generateCoachOpening,
} from "@/server/lib/alphaSpace";
import {
  jsonError,
  parseRequestBody,
  toFriendlyMessage,
} from "@/server/lib/apiErrors";

async function requireMember() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { error: NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 }) };
  const user = await db.query.user.findFirst({
    where: eq(userTable.email, session.user.email),
    columns: { id: true, name: true },
  });
  if (!user) return { error: NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 }) };
  const { active } = await getActiveWorkspace(user.id);
  if (!active) {
    return { error: NextResponse.json({ error: "No tienes un proyecto activo." }, { status: 403 }) };
  }
  return { user, active };
}

export async function GET() {
  try {
    const auth = await requireMember();
    if ("error" in auth) return auth.error;
    const { user, active } = auth;

    const sessions = await db.query.alphaSession.findMany({
      where: and(
        eq(alphaSession.userId, user.id),
        eq(alphaSession.workspaceId, active.workspaceId)
      ),
      orderBy: desc(alphaSession.updatedAt),
      limit: 50,
      columns: {
        id: true,
        title: true,
        framework: true,
        challenge: true,
        status: true,
        step: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    });

    const sessionIds = sessions.map((s) => s.id);
    const counts = sessionIds.length
      ? await db
          .select({
            sessionId: alphaMessage.sessionId,
            c: count(),
          })
          .from(alphaMessage)
          .where(inArray(alphaMessage.sessionId, sessionIds))
          .groupBy(alphaMessage.sessionId)
      : [];
    const countMap = new Map(
      counts.map((c) => [c.sessionId, Number(c.c)] as const)
    );
    const sessionsWithCount = sessions.map((s) => ({
      ...s,
      _count: { messages: countMap.get(s.id) ?? 0 },
    }));

    return NextResponse.json({ sessions: sessionsWithCount, frameworks: FRAMEWORKS });
  } catch (error) {
    return jsonError(error);
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(120),
  framework: z.string().default("strategic_dialogue"),
});

export async function POST(request: Request) {
  try {
    const auth = await requireMember();
    if ("error" in auth) return auth.error;
    const { user, active } = auth;

    const parsed = createSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: toFriendlyMessage(parsed.error) }, { status: 400 });
    }
    const framework = getFramework(parsed.data.framework);

    const sub = await db.query.workspaceSubscription.findFirst({
      where: eq(workspaceSubscription.workspaceId, active.workspaceId),
      columns: { plan: true },
    });
    const plan = sub?.plan ?? "team";
    const limit = getWeeklyLimit(plan);
    const since = startOfWeek();
    const [{ c: usedThisWeek }] = await db
      .select({ c: count() })
      .from(alphaSession)
      .where(
        and(
          eq(alphaSession.userId, user.id),
          eq(alphaSession.workspaceId, active.workspaceId),
          gte(alphaSession.createdAt, since)
        )
      );
    if (limit <= 0 || usedThisWeek >= limit) {
      return NextResponse.json(
        {
          error:
            limit <= 0
              ? "Alpha Space requiere un plan premium. Actualiza tu suscripción para acceder."
              : `Has alcanzado tu límite de ${limit} sesiones de Alpha Space esta semana.`,
          limit,
          usedThisWeek,
          plan,
        },
        { status: 402 }
      );
    }

    const [session] = await db
      .insert(alphaSession)
      .values({
        userId: user.id,
        workspaceId: active.workspaceId,
        title: parsed.data.title,
        framework: framework.key,
      })
      .returning();

    const opening = await generateCoachOpening({
      leaderName: user.name ?? "Líder",
      framework,
    });
    const openingText = opening.ok && opening.data
      ? opening.data
      : `Bienvenido a Alpha Space. Trabajaremos con el marco "${framework.name}". Para empezar: ${framework.steps[0].goal}. Cuéntame, ¿cuál es la situación en una frase?`;

    await db.insert(alphaMessage).values({
      sessionId: session.id,
      role: "coach",
      content: openingText,
      meta: { step: 0 },
    });

    return NextResponse.json({
      session,
      opening: openingText,
      usedThisWeek: usedThisWeek + 1,
      limit,
      plan,
    });
  } catch (error) {
    return jsonError(error);
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { user as userTable, feedbackCampaign, feedbackResponse } from "@drizzle/schema";
import { eq, and, desc, asc, gte, count } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import {
  CAMPAIGN_PRESETS,
  MIN_RESPONSES_FOR_INSIGHT,
  aggregateMetrics,
  summarizeFeedback,
  type FeedbackInsight,
} from "@/server/lib/feedbackIntelligence";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";

async function requireLeader() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 }) };
  }
  const user = await db.query.user.findFirst({
    where: eq(userTable.email, session.user.email),
    columns: { id: true, name: true },
  });
  if (!user) return { error: NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 }) };
  const { active } = await getActiveWorkspace(user.id);
  if (!active || (active.role !== "leader" && active.role !== "admin")) {
    return { error: NextResponse.json({ error: "Exclusivo para líderes." }, { status: 403 }) };
  }
  return { user, active };
}

/** GET: dashboard data — campaigns, metrics, trends, responses (anónimas). */
export async function GET(request: Request) {
  try {
    const auth = await requireLeader();
    if ("error" in auth) return auth.error;
    const { active } = auth;
    const { searchParams } = new URL(request.url);
    const windowDays = Math.max(1, Math.min(365, Number(searchParams.get("days") ?? "30")));

    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const [campaigns, counts, responses] = await Promise.all([
      db.query.feedbackCampaign.findMany({
        where: eq(feedbackCampaign.workspaceId, active.workspaceId),
        orderBy: desc(feedbackCampaign.createdAt),
      }),
      db
        .select({ campaignId: feedbackResponse.campaignId, c: count() })
        .from(feedbackResponse)
        .where(eq(feedbackResponse.workspaceId, active.workspaceId))
        .groupBy(feedbackResponse.campaignId),
      db.query.feedbackResponse.findMany({
        where: and(
          eq(feedbackResponse.workspaceId, active.workspaceId),
          gte(feedbackResponse.createdAt, since)
        ),
        orderBy: asc(feedbackResponse.createdAt),
        columns: {
          id: true,
          sentiment: true,
          emotion: true,
          scores: true,
          createdAt: true,
          payload: true,
        },
      }),
    ]);

    const countByCampaign = new Map(counts.map((r) => [r.campaignId, Number(r.c)]));

    const metrics = aggregateMetrics(responses as Array<{ sentiment: string | null; scores: unknown }>);

    // Tendencia: métricas por día (sentiment_score promedio + engagement)
    const byDay = new Map<string, { sentSum: number; sentN: number; engSum: number; engN: number; count: number }>();
    for (const r of responses) {
      const day = r.createdAt.toISOString().slice(0, 10);
      const slot = byDay.get(day) ?? { sentSum: 0, sentN: 0, engSum: 0, engN: 0, count: 0 };
      const sentimentMap: Record<string, number> = { positive: 90, neutral: 60, risk: 35, negative: 15 };
      if (r.sentiment) {
        slot.sentSum += sentimentMap[r.sentiment] ?? 50;
        slot.sentN++;
      }
      const eng = (r.scores as { engagement?: number } | null)?.engagement;
      if (typeof eng === "number") {
        slot.engSum += eng;
        slot.engN++;
      }
      slot.count++;
      byDay.set(day, slot);
    }
    const trend = Array.from(byDay.entries()).map(([day, s]) => ({
      day,
      sentiment_score: s.sentN ? Math.round(s.sentSum / s.sentN) : 0,
      engagement: s.engN ? Math.round(s.engSum / s.engN) : 0,
      count: s.count,
    }));

    // Distribución de emociones
    const emotionCount = new Map<string, number>();
    for (const r of responses) {
      if (r.emotion) emotionCount.set(r.emotion, (emotionCount.get(r.emotion) ?? 0) + 1);
    }
    const emotions = Array.from(emotionCount.entries())
      .map(([emotion, count]) => ({ emotion, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      campaigns: campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        kind: c.kind,
        cadence: c.cadence,
        status: c.status,
        responses: countByCampaign.get(c.id) ?? 0,
        createdAt: c.createdAt,
      })),
      metrics,
      trend,
      emotions,
      responseCount: responses.length,
      windowDays,
      minForInsight: MIN_RESPONSES_FOR_INSIGHT,
    });
  } catch (error) {
    return jsonError(error);
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(120),
  kind: z.string().default("pulse"),
  cadence: z.string().default("weekly"),
});

/** POST: crea una campaña (o la levanta de un preset). */
export async function POST(request: Request) {
  try {
    const auth = await requireLeader();
    if ("error" in auth) return auth.error;
    const { active } = auth;
    const parsed = createSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: toFriendlyMessage(parsed.error) }, { status: 400 });
    }

    const preset = CAMPAIGN_PRESETS.find((p) => p.kind === parsed.data.kind) ?? CAMPAIGN_PRESETS[0];
    const [campaign] = await db
      .insert(feedbackCampaign)
      .values({
        workspaceId: active.workspaceId,
        title: parsed.data.title,
        kind: parsed.data.kind,
        cadence: parsed.data.cadence,
        questions: preset.questions as unknown[],
        status: "active",
      })
      .returning();

    return NextResponse.json({ campaign });
  } catch (error) {
    return jsonError(error);
  }
}

/** Insights generados por IA sobre el conjunto de respuestas. */
export async function PATCH(request: Request) {
  try {
    const auth = await requireLeader();
    if ("error" in auth) return auth.error;
    const { active } = auth;

    const schema = z.object({ campaignId: z.string().optional() });
    const parsed = schema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: toFriendlyMessage(parsed.error) }, { status: 400 });
    }

    const where = parsed.data.campaignId
      ? and(
          eq(feedbackResponse.workspaceId, active.workspaceId),
          eq(feedbackResponse.campaignId, parsed.data.campaignId)
        )
      : eq(feedbackResponse.workspaceId, active.workspaceId);
    const responses = await db.query.feedbackResponse.findMany({
      where,
      orderBy: desc(feedbackResponse.createdAt),
      limit: 200,
      columns: { sentiment: true, emotion: true, scores: true, payload: true, createdAt: true },
    });

    if (responses.length < MIN_RESPONSES_FOR_INSIGHT) {
      return NextResponse.json({
        insight: null,
        reason: `Se necesitan al menos ${MIN_RESPONSES_FOR_INSIGHT} respuestas anónimas para generar un resumen (hay ${responses.length}). Protege la privacidad de quienes responden.`,
      });
    }

    const metrics = aggregateMetrics(responses as Array<{ sentiment: string | null; scores: unknown }>);
    const prepared = responses.map((r) => ({
      sentiment: r.sentiment ?? "neutral",
      emotion: r.emotion ?? "neutral",
      scores: (r.scores as Record<string, number>) ?? {},
      redactedText:
        (r.payload as { open_redacted?: string; open?: string } | null)?.open_redacted ??
        (r.payload as { open?: string } | null)?.open ??
        "",
      createdAt: r.createdAt.toISOString(),
    }));

    const result = await summarizeFeedback({ responses: prepared, metrics });
    if (!result.ok || !result.data) {
      return NextResponse.json({ insight: null, reason: "No pudimos generar el resumen ahora." });
    }
    return NextResponse.json({ insight: result.data satisfies FeedbackInsight, metrics });
  } catch (error) {
    return jsonError(error);
  }
}

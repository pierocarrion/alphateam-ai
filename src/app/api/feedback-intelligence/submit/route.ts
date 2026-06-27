import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { user as userTable, feedbackCampaign, feedbackResponse } from "@drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import {
  CAMPAIGN_PRESETS,
  analyzeAnswer,
} from "@/server/lib/feedbackIntelligence";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";

/**
 * Envío anónimo de una respuesta a una campaña.
 * Requiere sesión (el usuario es miembro del workspace) para evitar abuso,
 * pero NO se guarda ningún dato identificable: el userId se hashea y la
 * IA redacta cualquier referencia personal antes de persistir.
 */

const answerValue = z.union([z.number(), z.string()]).optional();

const submitSchema = z.object({
  campaignId: z.string().min(1),
  answers: z.record(z.string(), answerValue).default({}),
});

async function sha(s: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(s).digest("hex").slice(0, 32);
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Inicia sesión para responder." }, { status: 401 });
    }
    const user = await db.query.user.findFirst({
      where: eq(userTable.email, session.user.email),
      columns: { id: true },
    });
    if (!user) return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
    const { active } = await getActiveWorkspace(user.id);
    if (!active) return NextResponse.json({ error: "Workspace no encontrado." }, { status: 404 });

    const parsed = submitSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: toFriendlyMessage(parsed.error) }, { status: 400 });
    }

    const campaign = await db.query.feedbackCampaign.findFirst({
      where: and(
        eq(feedbackCampaign.id, parsed.data.campaignId),
        eq(feedbackCampaign.workspaceId, active.workspaceId),
        eq(feedbackCampaign.status, "active")
      ),
    });
    if (!campaign) return NextResponse.json({ error: "Campaña no encontrada o cerrada." }, { status: 404 });

    const questions = (campaign.questions as { id: string; type: string }[]) ?? [];
    const scaleAnswers: Record<string, number> = {};
    let textAnswer = "";
    for (const q of questions) {
      const v = parsed.data.answers[q.id];
      if (q.type === "scale") {
        const n = typeof v === "number" ? v : v ? Number(v) : NaN;
        if (Number.isFinite(n)) scaleAnswers[q.id] = Math.max(1, Math.min(5, n));
      } else if (typeof v === "string") {
        textAnswer += (textAnswer ? "\n" : "") + v.slice(0, 1200);
      }
    }

    const analysis = await analyzeAnswer({ scaleAnswers, textAnswer });
    const sentiment = analysis.ok && analysis.data ? analysis.data.sentiment : "neutral";
    const emotion = analysis.ok && analysis.data ? analysis.data.emotion : "neutral";
    const scores = analysis.ok && analysis.data ? analysis.data.scores : {};
    const redactedText =
      analysis.ok && analysis.data ? analysis.data.redactedText : "";

    const submitterHash = await sha(`${user.id}:${campaign.id}`);

    await db
      .insert(feedbackResponse)
      .values({
        campaignId: campaign.id,
        workspaceId: active.workspaceId,
        submitterHash,
        payload: { ...parsed.data.answers, open_redacted: redactedText },
        sentiment,
        emotion,
        scores: scores as unknown,
      })
      .returning();

    return NextResponse.json({ ok: true, sentiment, emotion, presets: CAMPAIGN_PRESETS.length });
  } catch (error) {
    return jsonError(error);
  }
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import {
  user as userTable,
  feedbackCampaign,
  feedbackResponse,
} from "@drizzle/schema";
import { eq, desc, count, inArray } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import {
  aggregateMetrics,
  METRIC_KEYS,
  MIN_RESPONSES_FOR_INSIGHT,
  CAMPAIGN_PRESETS,
} from "@/server/lib/feedbackIntelligence";
import { FeedbackIntelligenceClient } from "./FeedbackIntelligenceClient";

export default async function FeedbackIntelligencePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await db.query.user.findFirst({
    where: eq(userTable.email, session.user.email),
    columns: { id: true, name: true },
  });
  if (!user) redirect("/login");

  const { active } = await getActiveWorkspace(user.id);
  if (!active) {
    redirect("/home");
  }

  const [campaigns, responses] = await Promise.all([
    db.query.feedbackCampaign.findMany({
      where: eq(feedbackCampaign.workspaceId, active.workspaceId),
      orderBy: [desc(feedbackCampaign.createdAt)],
    }),
    db.query.feedbackResponse.findMany({
      where: eq(feedbackResponse.workspaceId, active.workspaceId),
      orderBy: [desc(feedbackResponse.createdAt)],
      columns: { sentiment: true, emotion: true, scores: true, createdAt: true },
      limit: 500,
    }),
  ]);

  const campaignIds = campaigns.map((c) => c.id);
  const counts = campaignIds.length
    ? await db
        .select({ campaignId: feedbackResponse.campaignId, c: count() })
        .from(feedbackResponse)
        .where(inArray(feedbackResponse.campaignId, campaignIds))
        .groupBy(feedbackResponse.campaignId)
    : [];
  const countMap = new Map(counts.map((r) => [r.campaignId, Number(r.c)]));

  const metrics = aggregateMetrics(
    responses as Array<{ sentiment: string | null; scores: unknown }>
  );

  return (
    <FeedbackIntelligenceClient
      leaderName={user.name ?? "Líder"}
      campaigns={campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        kind: c.kind,
        cadence: c.cadence,
        status: c.status,
        responses: countMap.get(c.id) ?? 0,
        createdAt: c.createdAt.toISOString(),
      }))}
      metrics={metrics}
      metricKeys={METRIC_KEYS}
      minForInsight={MIN_RESPONSES_FOR_INSIGHT}
      presets={CAMPAIGN_PRESETS.map((p) => ({ kind: p.kind, title: p.title, cadence: p.cadence }))}
    />
  );
}

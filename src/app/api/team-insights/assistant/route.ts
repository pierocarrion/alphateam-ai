import { NextResponse } from "next/server";
import {
  GetTeamOverview,
  getTeamOverviewSchema,
} from "@/features/insights/application/use-cases/GetTeamOverview";
import {
  AskTeamAssistant,
  askTeamAssistantInputSchema,
} from "@/features/insights/application/assistant/AskTeamAssistant";
import { teamInsightsFiltersSchema } from "@/features/insights/application/schemas";
import { container } from "@/server/lib/container";
import { getAiClient } from "@/server/lib/ai/client";
import {
  resolveTeamContext,
  jsonError,
} from "@/features/insights/infrastructure/http/resolveTeamContext";
import { getLocale } from "@/i18n/server";

const overviewUseCase = new GetTeamOverview(container.teamInsightsRepository);
const assistantUseCase = new AskTeamAssistant(getAiClient());

/**
 * AI Team Insights Assistant endpoint.
 *
 * The route resolves the active workspace (same auth path as the dashboard),
 * re-assembles the EXACT same {@link TeamOverview} the leader is looking at,
 * then asks the assistant to interpret it. This keeps the model grounded in
 * live dashboard data and avoids trusting any client-sent metrics.
 */
export async function POST(request: Request) {
  try {
    const ctx = await resolveTeamContext();
    if (!ctx.ok) return ctx.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Please send a valid JSON body." },
        { status: 400 }
      );
    }

    const locale = await getLocale();

    const parsedInput = askTeamAssistantInputSchema.safeParse({
      question: (body as { question?: unknown })?.question,
      history: (body as { history?: unknown })?.history,
      locale,
      daysWindow: (body as { daysWindow?: unknown })?.daysWindow ?? 90,
    });
    if (!parsedInput.success) return jsonError(parsedInput.error);

    const url = new URL(request.url);
    const parsedOverview = getTeamOverviewSchema.safeParse({
      workspaceId: ctx.context.workspaceId,
      granularity: url.searchParams.get("granularity") ?? "month",
      days: parsedInput.data.daysWindow ?? 90,
      filters: teamInsightsFiltersSchema.parse({
        seniority: url.searchParams.get("seniority") ?? undefined,
        position: url.searchParams.get("position") ?? undefined,
        sentiment: url.searchParams.get("sentiment") ?? undefined,
        risk: url.searchParams.get("risk") ?? undefined,
        since: url.searchParams.get("since") ?? undefined,
        until: url.searchParams.get("until") ?? undefined,
      }),
    });
    if (!parsedOverview.success) return jsonError(parsedOverview.error);

    const overview = await overviewUseCase.execute(parsedOverview.data);
    const answer = await assistantUseCase.execute(parsedInput.data, overview);

    return NextResponse.json(answer);
  } catch (error) {
    return jsonError(error);
  }
}

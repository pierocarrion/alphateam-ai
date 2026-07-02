import { NextResponse } from "next/server";
import { requireProjectLeader } from "@/server/lib/requireProjectLeader";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { getProjectSettingsDeps } from "@/features/project-settings/infrastructure/container";
import { SaveSmartGoal } from "@/features/project-settings/application/use-cases/SaveSmartGoal";
import { smartGoalSchema } from "@/features/project-settings/application/schemas";
import { container } from "@/server/lib/container";
import { createLogger } from "@/shared/lib/logger";

const log = createLogger("api:smart-goal");

/**
 * Best-effort extraction of a calendar deadline from the free-text Time-bound
 * dimension (e.g. "2026-09-30", "30 de septiembre de 2026", "fin de Q3 2026").
 * Returns null when the text doesn't describe a concrete date so the Progress
 * tracker simply stays undated instead of guessing.
 */
function parseDeadlineFromTimeBound(timeBound: string | null): Date | null {
  if (!timeBound || !timeBound.trim()) return null;
  // ISO-like dates parse reliably; anything else is left to the Date parser,
  // which handles common localized forms. Invalid results are discarded.
  const parsed = new Date(timeBound.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireProjectLeader((await params).id);
    if (auth.response) return auth.response;

    const deps = getProjectSettingsDeps();
    const smartGoal = await deps.smartGoalRepository.get(auth.workspaceId!);
    const versions = await deps.smartGoalRepository.listVersions(auth.workspaceId!);
    return NextResponse.json({ smartGoal, versions });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireProjectLeader((await params).id);
    if (auth.response) return auth.response;

    const parsed = smartGoalSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: toFriendlyMessage(parsed.error) }, { status: 400 });
    }

    const deps = getProjectSettingsDeps();
    const useCase = new SaveSmartGoal(deps);
    const smartGoal = await useCase.execute({
      ...parsed.data,
      workspaceId: auth.workspaceId!,
      actorId: auth.user.id,
    });

    // Sync the SMART goal into the Goal row that powers the Progress tracker,
    // so the leader's edited objective is visible in /progress.
    try {
      await container.goalProgressRepository.upsertActiveGoal(
        auth.workspaceId!,
        auth.user.id,
        {
          title: smartGoal.title,
          specific: smartGoal.specific,
          measurable: smartGoal.measurable,
          achievable: smartGoal.achievable,
          relevant: smartGoal.relevant,
          deadline: parseDeadlineFromTimeBound(smartGoal.timeBound),
        }
      );
    } catch (syncErr) {
      log.error("failed to sync into Goal/progress", syncErr);
    }

    return NextResponse.json({ smartGoal });
  } catch (error) {
    return jsonError(error);
  }
}

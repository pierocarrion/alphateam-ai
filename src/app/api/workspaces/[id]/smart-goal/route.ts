import { NextResponse } from "next/server";
import { requireProjectLeader } from "@/server/lib/requireProjectLeader";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { getProjectSettingsDeps } from "@/features/project-settings/infrastructure/container";
import { SaveSmartGoal } from "@/features/project-settings/application/use-cases/SaveSmartGoal";
import { smartGoalSchema } from "@/features/project-settings/application/schemas";
import { container } from "@/server/lib/container";

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
          deadline: smartGoal.deadline ? new Date(smartGoal.deadline) : null,
        }
      );
    } catch (syncErr) {
      console.error("[smart-goal] failed to sync into Goal/progress", syncErr);
    }

    return NextResponse.json({ smartGoal });
  } catch (error) {
    return jsonError(error);
  }
}

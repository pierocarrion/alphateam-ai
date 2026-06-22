import { NextResponse } from "next/server";
import { requireUser } from "@/server/lib/auth";
import { container } from "@/server/lib/container";
import { jsonError } from "@/server/lib/apiErrors";
import { ListPendingRequests } from "@/features/projects/application/use-cases/ListPendingRequests";

const listPendingRequests = new ListPendingRequests(container.projectRepository);

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const requests = await listPendingRequests.execute({
      leaderUserId: auth.user.id,
    });

    return NextResponse.json({ requests });
  } catch (error) {
    return jsonError(error);
  }
}

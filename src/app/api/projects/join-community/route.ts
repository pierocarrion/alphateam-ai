import { NextResponse } from "next/server";
import { requireUser } from "@/server/lib/auth";
import { container } from "@/server/lib/container";
import { jsonError } from "@/server/lib/apiErrors";
import { JoinCommunity } from "@/features/projects/application/use-cases/JoinCommunity";

const joinCommunity = new JoinCommunity(container.projectRepository);

export async function POST() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const workspace = await joinCommunity.execute(auth.user.id);
    return NextResponse.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}

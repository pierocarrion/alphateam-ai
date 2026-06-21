import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { runWorkspaceHealthCheck } from "@/server/lib/aiCheckEngine";
import { jsonError } from "@/server/lib/apiErrors";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Please sign in to continue." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "We couldn't find your account. Please sign in again." },
        { status: 404 }
      );
    }

    const workspace = await prisma.workspace.findUnique({
      where: { slug: "acme" },
      include: {
        channels: { where: { name: "q3-launch" }, take: 1 },
        memberships: { where: { userId: user.id } },
      },
    });

    if (!workspace || workspace.memberships.length === 0) {
      return NextResponse.json(
        { error: "No default channel is set up for you yet." },
        { status: 404 }
      );
    }

    const channel = workspace.channels[0];
    if (!channel) {
      return NextResponse.json(
        { error: "We couldn't find the default channel." },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    if (searchParams.get("health") === "1") {
      const report = await runWorkspaceHealthCheck(workspace.id);
      return NextResponse.json({ channel: { id: channel.id, name: channel.name }, health: report });
    }

    return NextResponse.json({ channel: { id: channel.id, name: channel.name } });
  } catch (error) {
    return jsonError(error);
  }
}

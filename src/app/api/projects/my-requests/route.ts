import { NextResponse } from "next/server";
import { requireUser } from "@/server/lib/auth";
import { prisma } from "@/server/lib/prisma";
import { jsonError } from "@/server/lib/apiErrors";

export async function GET() {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const requests = await prisma.joinRequest.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            hashtag: true,
            emoji: true,
          },
        },
      },
    });

    const data = requests.map((r) => ({
      id: r.id,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt,
      workspace: {
        id: r.workspace.id,
        name: r.workspace.name,
        hashtag: r.workspace.hashtag,
        emoji: r.workspace.emoji,
      },
    }));

    return NextResponse.json({ requests: data });
  } catch (error) {
    return jsonError(error);
  }
}

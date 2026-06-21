import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { jsonError } from "@/server/lib/apiErrors";

export async function GET() {
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
      include: { memberships: { include: { workspace: { include: { subscriptions: true } } } } },
    });
    if (!user) {
      return NextResponse.json(
        { error: "We couldn't find your account. Please sign in again." },
        { status: 404 }
      );
    }

    const membership = user.memberships[0];
    const subscription = membership?.workspace.subscriptions[0] ?? {
      plan: "free",
      status: "active",
    };

    return NextResponse.json({ subscription });
  } catch (error) {
    return jsonError(error);
  }
}

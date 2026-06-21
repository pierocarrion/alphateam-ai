import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/server/lib/prisma";
import { getStripe, getPriceId } from "@/server/lib/stripe";
import { jsonError, parseRequestBody } from "@/server/lib/apiErrors";

export async function POST(request: Request) {
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
      include: { memberships: { include: { workspace: true } } },
    });
    if (!user) {
      return NextResponse.json(
        { error: "We couldn't find your account. Please sign in again." },
        { status: 404 }
      );
    }

    const membership = user.memberships[0];
    if (!membership) {
      return NextResponse.json(
        { error: "You need a workspace before upgrading. Please set one up first." },
        { status: 400 }
      );
    }

    const body = (await parseRequestBody(request)) as { plan?: "team" | "business"; returnUrl?: string };
    const plan = body.plan === "business" ? "business" : "team";
    const returnUrl = body.returnUrl ?? `${process.env.NEXTAUTH_URL}/settings`;

    // Upsert Stripe customer for the workspace.
    const subscription = await prisma.workspaceSubscription.findUnique({
      where: { workspaceId: membership.workspaceId },
    });

    let customerId = subscription?.stripeCustomerId;
    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: session.user.email,
        metadata: { workspaceId: membership.workspaceId },
      });
      customerId = customer.id;

      await prisma.workspaceSubscription.upsert({
        where: { workspaceId: membership.workspaceId },
        create: {
          workspaceId: membership.workspaceId,
          stripeCustomerId: customerId,
          plan: "free",
          status: "active",
        },
        update: { stripeCustomerId: customerId },
      });
    }

    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: getPriceId(plan), quantity: 1 }],
      success_url: `${returnUrl}?stripe=success`,
      cancel_url: `${returnUrl}?stripe=cancel`,
      metadata: { workspaceId: membership.workspaceId, plan },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    return jsonError(error);
  }
}

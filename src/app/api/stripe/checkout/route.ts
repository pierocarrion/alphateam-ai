import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/lib/db";
import { workspaceSubscription } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { getStripe, getPriceId } from "@/server/lib/stripe";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { requireUser } from "@/server/lib/auth";

const bodySchema = z.object({
  plan: z.enum(["team", "business"]).optional(),
  returnUrl: z.string().url().optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const user = auth.user;

    const { active } = await getActiveWorkspace(user.id);
    if (!active) {
      return NextResponse.json(
        { error: "You need a workspace before upgrading. Please set one up first." },
        { status: 400 }
      );
    }

    const workspaceId = active.workspaceId;

    const parsed = bodySchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    const plan = parsed.data.plan === "business" ? "business" : "team";
    const returnUrl = parsed.data.returnUrl ?? `${process.env.NEXTAUTH_URL}/settings`;

    // Upsert Stripe customer for the workspace.
    const subscription = await db.query.workspaceSubscription.findFirst({
      where: eq(workspaceSubscription.workspaceId, workspaceId),
    });

    let customerId = subscription?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email ?? undefined,
        metadata: { workspaceId },
      });
      customerId = customer.id;

      await db
        .insert(workspaceSubscription)
        .values({
          workspaceId,
          stripeCustomerId: customerId,
          plan: "free",
          status: "active",
        })
        .onConflictDoUpdate({
          target: workspaceSubscription.workspaceId,
          set: { stripeCustomerId: customerId },
        });
    }

    const checkoutSession = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: getPriceId(plan), quantity: 1 }],
      success_url: `${returnUrl}?stripe=success`,
      cancel_url: `${returnUrl}?stripe=cancel`,
      metadata: { workspaceId, plan },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    return jsonError(error);
  }
}

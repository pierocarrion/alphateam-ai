import { NextResponse } from "next/server";
import { getStripe } from "@/server/lib/stripe";
import { prisma } from "@/server/lib/prisma";
import Stripe from "stripe";
import { jsonError, toFriendlyMessage } from "@/server/lib/apiErrors";
import { notifyUser } from "@/server/lib/notifications";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Finds the workspace owner (the leader/admin with the earliest membership) for
 * a subscription row, so we can notify them of billing issues.
 */
async function findOwnerUserIdBySubscription(
  subscriptionId: string
): Promise<{ userId: string; workspaceId: string } | null> {
  const sub = await prisma.workspaceSubscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    select: { workspaceId: true },
  });
  if (!sub) return null;
  const leader = await prisma.membership.findFirst({
    where: {
      workspaceId: sub.workspaceId,
      role: { in: ["leader", "admin"] },
      status: "active",
    },
    orderBy: { joinedAt: "asc" },
    select: { userId: true },
  });
  return leader ? { userId: leader.userId, workspaceId: sub.workspaceId } : null;
}

export async function POST(request: Request) {
  try {
    const payload = await request.text();
    const signature = request.headers.get("stripe-signature") ?? "";

    if (!webhookSecret) {
      return NextResponse.json(
        { error: "Payments aren't fully configured yet. Please try again later." },
        { status: 500 }
      );
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      return NextResponse.json(
        { error: toFriendlyMessage(err) || "We couldn't verify that payment event." },
        { status: 400 }
      );
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.metadata?.workspaceId;
        const plan = (session.metadata?.plan as "team" | "business") ?? "team";
        if (workspaceId && session.subscription) {
          await prisma.workspaceSubscription.upsert({
            where: { workspaceId },
            create: {
              workspaceId,
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              plan,
              status: "active",
            },
            update: {
              stripeSubscriptionId: session.subscription as string,
              plan,
              status: "active",
            },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        // Stripe Invoice types omit subscription in some versions; cast safely.
        const subscriptionId = (invoice as unknown as { subscription?: string }).subscription;
        if (subscriptionId) {
          await prisma.workspaceSubscription.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: { status: "past_due" },
          });
          const owner = await findOwnerUserIdBySubscription(subscriptionId);
          if (owner) {
            await notifyUser({
              userId: owner.userId,
              type: "payment_failed",
              title: "No pudimos cobrar tu suscripción",
              body: "Hubo un problema con tu método de pago. Revisa tu facturación para evitar perder acceso.",
              data: { workspaceId: owner.workspaceId },
              workspaceId: owner.workspaceId,
              url: "/settings/billing",
            }).catch(() => void 0);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.workspaceSubscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: "cancelled", plan: "free" },
        });
        const owner = await findOwnerUserIdBySubscription(sub.id);
        if (owner) {
          await notifyUser({
            userId: owner.userId,
            type: "subscription_cancelled",
            title: "Tu suscripción fue cancelada",
            body: "Tu plan pasó a free. Puedes reactivarlo cuando quieras desde facturación.",
            data: { workspaceId: owner.workspaceId },
            workspaceId: owner.workspaceId,
            url: "/settings/billing",
          }).catch(() => void 0);
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return jsonError(error);
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import {
  alphaMessage,
  alphaSession,
  user as userTable,
} from "@drizzle/schema";
import { eq, and, asc } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import {
  generateCoachTurn,
  getFramework,
} from "@/server/lib/alphaSpace";
import {
  jsonError,
  parseRequestBody,
  toFriendlyMessage,
} from "@/server/lib/apiErrors";

const messageSchema = z.object({
  message: z.string().min(1).max(4000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
    }
    const user = await db.query.user.findFirst({
      where: eq(userTable.email, session.user.email),
      columns: { id: true, name: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
    }
    const { active } = await getActiveWorkspace(user.id);
    if (!active || (active.role !== "leader" && active.role !== "admin")) {
      return NextResponse.json({ error: "Exclusivo para líderes." }, { status: 403 });
    }

    const { id } = await params;
    const alpha = await db.query.alphaSession.findFirst({
      where: and(
        eq(alphaSession.id, id),
        eq(alphaSession.userId, user.id),
        eq(alphaSession.workspaceId, active.workspaceId)
      ),
    });
    if (!alpha) {
      return NextResponse.json({ error: "Sesión no encontrada." }, { status: 404 });
    }
    const messages = await db.query.alphaMessage.findMany({
      where: eq(alphaMessage.sessionId, alpha.id),
      orderBy: asc(alphaMessage.createdAt),
      limit: 40,
    });

    const parsed = messageSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: toFriendlyMessage(parsed.error) }, { status: 400 });
    }

    await db.insert(alphaMessage).values({
      sessionId: alpha.id,
      role: "user",
      content: parsed.data.message,
    });

    const framework = getFramework(alpha.framework);
    const history = messages
      .filter((m) => m.role === "user" || m.role === "coach")
      .map((m) => ({
        role: m.role as "user" | "coach",
        content: m.content,
      }));

    const turn = await generateCoachTurn({
      leaderName: user.name ?? "Líder",
      framework,
      stepIndex: alpha.step,
      challenge: alpha.challenge,
      history,
      userInput: parsed.data.message,
    });

    let replyText: string;
    let stepComplete = false;
    let fieldKey: string | null = null;
    let fieldValue: string | null = null;
    let suggestion: string | null = null;
    let newStep = alpha.step;
    let newChallenge = alpha.challenge;

    if (turn.ok && turn.data) {
      replyText = turn.data.reply;
      stepComplete = !!turn.data.stepComplete;
      fieldKey = turn.data.fieldKey;
      fieldValue = turn.data.fieldValue;
      suggestion = turn.data.suggestion ?? null;
    } else {
      const step = framework.steps[alpha.step];
      replyText = step
        ? `Gracias por compartirlo. Para profundizar en "${step.label}": ${step.goal}. ¿Qué más puedes observar sobre esto?`
        : "¿Qué más quieres explorar aquí?";
    }

    if (stepComplete && newStep < framework.steps.length - 1) {
      newStep = newStep + 1;
    }

    if (alpha.step === 0 && fieldKey === "challenge" && fieldValue && !newChallenge) {
      newChallenge = fieldValue.slice(0, 280);
    }

    const doc =
      (alpha.documentJson as {
        sections: { id: string; label: string; content: string }[];
      } | null) ?? {
        sections: framework.steps.map((s) => ({
          id: s.id,
          label: s.label,
          content: "",
        })),
      };
    if (fieldKey && fieldValue) {
      const idx = doc.sections.findIndex((s) => s.id === fieldKey);
      if (idx >= 0) {
        doc.sections[idx] = {
          ...doc.sections[idx],
          content: fieldValue,
        };
      }
    }

    const isComplete = newStep >= framework.steps.length - 1 && stepComplete;

    await db
      .update(alphaSession)
      .set({
        step: newStep,
        challenge: newChallenge,
        documentJson: doc as object,
        status: isComplete ? "completed" : alpha.status,
        completedAt: isComplete ? new Date() : null,
      })
      .where(eq(alphaSession.id, alpha.id));

    await db.insert(alphaMessage).values({
      sessionId: alpha.id,
      role: "coach",
      content: replyText,
      meta: { step: newStep, fieldKey, suggestion },
    });

    return NextResponse.json({
      reply: replyText,
      step: newStep,
      stepComplete,
      completed: isComplete,
      fieldKey,
      fieldValue,
      suggestion,
      document: doc,
      totalSteps: framework.steps.length,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
    }
    const user = await db.query.user.findFirst({
      where: eq(userTable.email, session.user.email),
      columns: { id: true },
    });
    if (!user) return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
    const { active } = await getActiveWorkspace(user.id);
    if (!active) return NextResponse.json({ error: "Workspace no encontrado." }, { status: 404 });

    const { id } = await params;
    const alpha = await db.query.alphaSession.findFirst({
      where: and(
        eq(alphaSession.id, id),
        eq(alphaSession.userId, user.id),
        eq(alphaSession.workspaceId, active.workspaceId)
      ),
    });
    if (!alpha) return NextResponse.json({ error: "Sesión no encontrada." }, { status: 404 });

    const messages = await db.query.alphaMessage.findMany({
      where: eq(alphaMessage.sessionId, alpha.id),
      orderBy: asc(alphaMessage.createdAt),
    });

    return NextResponse.json({
      session: { ...alpha, messages },
      framework: getFramework(alpha.framework),
    });
  } catch (error) {
    return jsonError(error);
  }
}

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  document: z
    .object({
      sections: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          content: z.string(),
        })
      ),
    })
    .optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
    }
    const user = await db.query.user.findFirst({
      where: eq(userTable.email, session.user.email),
      columns: { id: true },
    });
    if (!user) return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
    const { active } = await getActiveWorkspace(user.id);
    if (!active || (active.role !== "leader" && active.role !== "admin")) {
      return NextResponse.json({ error: "Exclusivo para líderes." }, { status: 403 });
    }

    const { id } = await params;
    const parsed = patchSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: toFriendlyMessage(parsed.error) }, { status: 400 });
    }

    const existing = await db.query.alphaSession.findFirst({
      where: and(
        eq(alphaSession.id, id),
        eq(alphaSession.userId, user.id),
        eq(alphaSession.workspaceId, active.workspaceId)
      ),
    });
    if (!existing) return NextResponse.json({ error: "Sesión no encontrada." }, { status: 404 });

    const [updated] = await db
      .update(alphaSession)
      .set({
        title: parsed.data.title,
        status: parsed.data.status,
        documentJson: parsed.data.document as object,
      })
      .where(eq(alphaSession.id, id))
      .returning();

    return NextResponse.json({ session: updated });
  } catch (error) {
    return jsonError(error);
  }
}

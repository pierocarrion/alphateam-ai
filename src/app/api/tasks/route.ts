import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/lib/db";
import { task as taskTable } from "@drizzle/schema";
import { DetectedTaskDraft } from "@/features/tasks/lib/detect";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { requireUser } from "@/server/lib/auth";

const bodySchema = z.object({
  messageId: z.string().optional(),
  draft: z.object({
    title: z.string().min(1),
    fromQuote: z.string(),
    category: z.string(),
    app: z.string(),
    due: z.string(),
    deadline: z.union([z.string(), z.date()]).nullable().optional(),
    load: z.enum(["Light", "Medium", "Heavy"]),
    micro: z.string(),
    action: z.string(),
    resource: z.string(),
    selfMade: z.boolean(),
    confidence: z.number(),
  }),
});

function guessQuadrant(draft: DetectedTaskDraft): string | null {
  const urgent = /tomorrow|tonight|today|asap|urgent|before/.test(draft.due.toLowerCase());
  const important = draft.load === "Heavy" || draft.load === "Medium";
  if (urgent && important) return "q1";
  if (!urgent && important) return "q2";
  if (urgent && !important) return "q3";
  return "q4";
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;
    const user = auth.user;

    const parsed = bodySchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    const { messageId, draft } = parsed.data;

    const taskDraft: DetectedTaskDraft = {
      ...draft,
      deadline: draft.deadline ? new Date(draft.deadline) : null,
    };

    const [task] = await db.insert(taskTable).values({
      userId: user.id,
      messageId: messageId ?? null,
      title: taskDraft.title,
      fromQuote: taskDraft.fromQuote,
      category: taskDraft.category,
      app: taskDraft.app,
      due: taskDraft.due,
      deadline: taskDraft.deadline,
      load: taskDraft.load,
      micro: taskDraft.micro,
      action: taskDraft.action,
      resource: taskDraft.resource,
      selfMade: taskDraft.selfMade,
      status: "open",
      quadrant: guessQuadrant(taskDraft),
      priority: taskDraft.load === "Heavy" ? 5 : taskDraft.load === "Medium" ? 3 : 1,
      tags: [taskDraft.category.toLowerCase()],
    }).returning();

    return NextResponse.json({ task });
  } catch (error) {
    return jsonError(error);
  }
}

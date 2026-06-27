import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireUser } from "@/server/lib/auth";
import { container } from "@/server/lib/container";
import { jsonError, parseRequestBody, toFriendlyMessage } from "@/server/lib/apiErrors";
import { db } from "@/server/lib/db";
import { knowledgeBaseItem } from "@drizzle/schema";

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  content: z.string().min(1).max(8000).optional(),
  sourceUrl: z.string().max(500).optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const { id, itemId } = await params;
    const isLeader = await container.projectRepository.isLeader(
      auth.user.id,
      id
    );
    if (!isLeader) {
      return NextResponse.json(
        { error: "Solo el líder del proyecto puede editar las entradas." },
        { status: 403 }
      );
    }

    const parsed = patchSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    const existing = await db.query.knowledgeBaseItem.findFirst({
      where: eq(knowledgeBaseItem.id, itemId),
      columns: { workspaceId: true },
    });
    if (!existing || existing.workspaceId !== id) {
      return NextResponse.json(
        { error: "Esa entrada no pertenece a este proyecto." },
        { status: 404 }
      );
    }

    const item = await container.projectRepository.updateKnowledge(itemId, {
      title: parsed.data.title,
      content: parsed.data.content,
      sourceUrl: parsed.data.sourceUrl ?? undefined,
    });

    return NextResponse.json({ item });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const { id, itemId } = await params;
    const isLeader = await container.projectRepository.isLeader(
      auth.user.id,
      id
    );
    if (!isLeader) {
      return NextResponse.json(
        { error: "Solo el líder del proyecto puede eliminar entradas." },
        { status: 403 }
      );
    }

    const existing = await db.query.knowledgeBaseItem.findFirst({
      where: eq(knowledgeBaseItem.id, itemId),
      columns: { workspaceId: true },
    });
    if (!existing || existing.workspaceId !== id) {
      return NextResponse.json(
        { error: "Esa entrada no pertenece a este proyecto." },
        { status: 404 }
      );
    }

    await container.projectRepository.deleteKnowledge(itemId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
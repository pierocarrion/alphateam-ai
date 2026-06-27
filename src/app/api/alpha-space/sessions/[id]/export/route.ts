import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/server/lib/db";
import { alphaSession, user as userTable } from "@drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getActiveWorkspace } from "@/server/lib/activeWorkspace";
import {
  getFramework,
  documentToExport,
  type AlphaDocumentData,
} from "@/server/lib/alphaSpace";
import {
  jsonError,
  parseRequestBody,
  toFriendlyMessage,
} from "@/server/lib/apiErrors";

const exportSchema = z.object({
  format: z.enum(["pdf", "word", "slides"]),
  title: z.string().min(1).max(160).optional(),
  sections: z
    .array(z.object({ id: z.string(), label: z.string(), content: z.string() }))
    .optional(),
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
      columns: { id: true },
    });
    if (!user) return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
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
    if (!alpha) return NextResponse.json({ error: "Sesión no encontrada." }, { status: 404 });

    const parsed = exportSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: toFriendlyMessage(parsed.error) }, { status: 400 });
    }

    const framework = getFramework(alpha.framework);
    const stored =
      (alpha.documentJson as {
        sections: { id: string; label: string; content: string }[];
      } | null) ?? null;

    const sections =
      parsed.data.sections ??
      stored?.sections ??
      framework.steps.map((s) => ({ id: s.id, label: s.label, content: "" }));

    const doc: AlphaDocumentData = {
      title: parsed.data.title ?? alpha.title,
      kind: framework.docKind,
      sections,
    };

    const exported = documentToExport(doc, parsed.data.format);

    return new NextResponse(exported.content, {
      status: 200,
      headers: {
        "Content-Type": exported.mime,
        "Content-Disposition": `attachment; filename="${exported.filename}"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

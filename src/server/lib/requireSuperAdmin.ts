import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { eq } from "drizzle-orm";
import { db } from "@/server/lib/db";
import { user as userTable } from "@drizzle/schema";

export interface SuperAdminUser {
  id: string;
  email: string | null;
  name: string | null;
}

export interface RequireSuperAdminResult {
  user: SuperAdminUser;
  response: null;
}

export interface RequireSuperAdminErrorResponse {
  user: null;
  response: NextResponse;
}

/**
 * Verifica que la petición proviene de un usuario con `globalRole === "superadmin"`.
 * Recarga el rol desde la BD para evitar confiar solo en el JWT (que puede estar
 * cacheado). Si el usuario ha sido bloqueado o degradado, se rechaza aquí.
 */
export async function requireSuperAdmin(): Promise<
  RequireSuperAdminResult | RequireSuperAdminErrorResponse
> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Inicia sesión como administrador." },
        { status: 401 }
      ),
    };
  }

  const u = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
    columns: {
      id: true,
      email: true,
      name: true,
      globalRole: true,
      blocked: true,
    },
  });

  if (!u || u.blocked || u.globalRole !== "superadmin") {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Acceso restringido a super administradores." },
        { status: 403 }
      ),
    };
  }

  return {
    user: { id: u.id, email: u.email, name: u.name },
    response: null,
  };
}

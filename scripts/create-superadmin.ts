/**
 * Crea (o promociona) una cuenta super-administrador de la plataforma.
 *
 * Uso:
 *   npx tsx scripts/create-superadmin.ts --email=admin@alpha.com --password=Alph@Lead#2026!Secure [--name="Admin"]
 *
 * Sobrescribe `globalRole` a "superadmin" si el usuario ya existe, o crea uno
 * nuevo con `passwordHash` (bcrypt) y `UserProfile` con `onboarded = true`
 * para que no caiga en el flujo de onboarding.
 */
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import * as schema from "@drizzle/schema";

async function main() {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const found = args.find((a) => a.startsWith(`--${key}=`));
    return found ? found.slice(key.length + 3) : undefined;
  };

  const email = (get("email") ?? "admin@alpha.com").toLowerCase().trim();
  const password = get("password") ?? "Alph@Lead#2026!Secure";
  const name = get("name") ?? "Super Admin";
  if (!email || !password) {
    console.error("Uso: --email=... --password=... [--name=...]");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("La contraseña debe tener al menos 6 caracteres.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(eq(schema.user.email, email))
        .limit(1);

      if (existing) {
        const [updated] = await tx
          .update(schema.user)
          .set({
            name,
            passwordHash,
            globalRole: "superadmin",
            blocked: false,
          })
          .where(eq(schema.user.id, existing.id))
          .returning({
            id: schema.user.id,
            email: schema.user.email,
            globalRole: schema.user.globalRole,
          });
        return updated!;
      }

      const [created] = await tx
        .insert(schema.user)
        .values({
          email,
          name,
          passwordHash,
          globalRole: "superadmin",
          emailVerified: new Date(),
        })
        .returning({
          id: schema.user.id,
          email: schema.user.email,
          globalRole: schema.user.globalRole,
        });
      await tx.insert(schema.userProfile).values({
        userId: created!.id,
        onboarded: true,
        role: "Super Admin",
      });
      return created!;
    });

    console.log("✅ Super-admin listo:", result);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

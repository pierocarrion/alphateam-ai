/**
 * Crea (o promociona) una cuenta super-administrador de la plataforma.
 *
 * Uso:
 *   npx tsx scripts/create-superadmin.ts --email=admin@alphateam.com --password=Admin123! [--name="Admin"]
 *
 * Sobrescribe `globalRole` a "superadmin" si el usuario ya existe, o crea uno
 * nuevo con `passwordHash` (bcrypt) y `UserProfile` con `onboarded = true`
 * para que no caiga en el flujo de onboarding.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

async function main() {
  const args = process.argv.slice(2);
  const get = (key: string) => {
    const found = args.find((a) => a.startsWith(`--${key}=`));
    return found ? found.slice(key.length + 3) : undefined;
  };

  const email = (get("email") ?? "admin@alphateam.com").toLowerCase().trim();
  const password = get("password") ?? "Admin123!";
  const name = get("name") ?? "Super Admin";
  if (!email || !password) {
    console.error("Uso: --email=... --password=... [--name=...]");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("La contraseña debe tener al menos 6 caracteres.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name,
        passwordHash,
        globalRole: "superadmin",
        emailVerified: new Date(),
        profile: { create: { onboarded: true, role: "Super Admin" } },
      },
      update: {
        name,
        passwordHash,
        globalRole: "superadmin",
        blocked: false,
      },
      select: { id: true, email: true, globalRole: true },
    });

    console.log("✅ Super-admin listo:", user);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

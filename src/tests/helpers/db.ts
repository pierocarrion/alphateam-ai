import { execSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { PrismaClient } from "@prisma/client";

let pglite: PGlite | undefined;
let prisma: PrismaClient | undefined;
let schemaApplied = false;
let cachedSchemaSql: string | undefined;

export async function getPglite(): Promise<PGlite> {
  if (!pglite) {
    pglite = new PGlite();
  }
  return pglite;
}

function getSchemaSql(): string {
  if (!cachedSchemaSql) {
    cachedSchemaSql = execSync(
      "npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script",
      {
        cwd: process.cwd(),
        encoding: "utf-8",
        env: {
          ...process.env,
          DATABASE_URL:
            process.env.DATABASE_URL ?? "postgresql://localhost:5432/alphateam-ai",
        },
      }
    );
  }
  return cachedSchemaSql;
}

export async function setupTestDatabase() {
  const client = await getPglite();

  if (!schemaApplied) {
    const sql = getSchemaSql();
    await client.exec(sql);
    schemaApplied = true;
  }

  const adapter = new PrismaPGlite(client);

  // Inject adapter into the production prisma singleton so API routes use PGlite.
  const g = global as unknown as {
    __testPrismaAdapter?: unknown;
    prisma?: PrismaClient;
  };
  g.__testPrismaAdapter = adapter;
  delete g.prisma;

  prisma = new PrismaClient({ adapter });
  g.prisma = prisma;

  return prisma;
}

export async function getTestPrisma(): Promise<PrismaClient> {
  if (!prisma) {
    await setupTestDatabase();
  }
  return prisma!;
}

export async function resetDatabase() {
  const client = await getTestPrisma();
  await client.$transaction([
    client.ritualSession.deleteMany(),
    client.task.deleteMany(),
    client.message.deleteMany(),
    client.channel.deleteMany(),
    client.membership.deleteMany(),
    client.workspace.deleteMany(),
    client.userProfile.deleteMany(),
    client.session.deleteMany(),
    client.account.deleteMany(),
    client.verificationToken.deleteMany(),
    client.user.deleteMany(),
  ]);
}

export async function seedWorkspace() {
  const client = await getTestPrisma();
  const workspace = await client.workspace.create({
    data: {
      name: "Acme",
      slug: "acme",
    },
  });
  const channel = await client.channel.create({
    data: {
      workspaceId: workspace.id,
      name: "q3-launch",
    },
  });
  return { workspace, channel };
}

export async function seedUser(input?: {
  name?: string;
  email?: string;
  password?: string;
  onboarded?: boolean;
}) {
  const client = await getTestPrisma();
  const name = input?.name ?? "Test User";
  const email =
    input?.email?.toLowerCase() ??
    `test-${crypto.randomUUID()}@example.com`;
  const passwordHash = input?.password ?? "password123";

  const user = await client.user.create({
    data: {
      name,
      email,
      passwordHash,
      profile: {
        create: {
          onboarded: input?.onboarded ?? false,
        },
      },
    },
  });

  return { user, email, password: passwordHash };
}

export async function seedMember(input?: {
  name?: string;
  email?: string;
  password?: string;
  onboarded?: boolean;
  workspaceId?: string;
}) {
  const client = await getTestPrisma();
  const { user, email, password } = await seedUser(input);
  const { workspace, channel } = input?.workspaceId
    ? await (async () => {
        const workspace = await client.workspace.findUniqueOrThrow({
          where: { id: input.workspaceId },
        });
        const channel = await client.channel.findFirstOrThrow({
          where: { workspaceId: workspace.id },
        });
        return { workspace, channel };
      })()
    : await seedWorkspace();

  await client.membership.create({
    data: {
      userId: user.id,
      workspaceId: workspace.id,
      role: "member",
    },
  });

  return { user, email, password, workspaceId: workspace.id, workspace, channel };
}

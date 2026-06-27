import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { inArray, eq } from "drizzle-orm";
import type { Db } from "@/server/lib/db";
import * as schema from "@drizzle/schema";

let pglite: PGlite | undefined;
let db: Db | undefined;
let schemaApplied = false;

// Drizzle migrations live at <repo>/drizzle. CWD-relative is robust across
// vitest workers (the drizzle-kit migrator resolves migration files from here).
const migrationsFolder = `${process.cwd()}/drizzle`;

export async function getPglite(): Promise<PGlite> {
  if (!pglite) {
    pglite = new PGlite();
  }
  return pglite;
}

/**
 * Bring up the in-memory PGlite database, apply the Drizzle schema, and inject
 * the Drizzle instance into the production singleton (`global.__testDb`) so
 * every Server Component / Route Handler resolves to PGlite at runtime.
 */
export async function setupTestDatabase(): Promise<Db> {
  const client = await getPglite();

  if (!schemaApplied) {
    db = drizzle(client, { schema }) as unknown as Db;
    await migrate(db, { migrationsFolder });
    schemaApplied = true;
  } else {
    db = drizzle(client, { schema }) as unknown as Db;
  }

  const g = globalThis as unknown as { __testDb?: Db };
  g.__testDb = db;
  return db;
}

export async function getTestDb(): Promise<Db> {
  if (!db) {
    await setupTestDatabase();
  }
  return db!;
}

/**
 * Wipes every table in an FK-safe order. Tables are deleted in a single
 * transaction so a reset is atomic even if a test runs midway.
 */
export async function resetDatabase(): Promise<void> {
  const client = await getTestDb();
  await client.transaction(async (tx) => {
    await tx.delete(schema.projectKpiSnapshot);
    await tx.delete(schema.projectKpi);
    await tx.delete(schema.kpiDefinition);
    await tx.delete(schema.projectAiInsight);
    await tx.delete(schema.projectInvitation);
    await tx.delete(schema.projectMethodology);
    await tx.delete(schema.smartGoalVersion);
    await tx.delete(schema.projectSmartGoal);
    await tx.delete(schema.projectRole);
    await tx.delete(schema.auditLog);
    await tx.delete(schema.userMetric);
    await tx.delete(schema.teamMetric);
    await tx.delete(schema.ritualSession);
    await tx.delete(schema.task);
    await tx.delete(schema.message);
    await tx.delete(schema.milestone);
    await tx.delete(schema.goal);
    await tx.delete(schema.knowledgeBaseItem);
    await tx.delete(schema.channelParticipant);
    await tx.delete(schema.channel);
    await tx.delete(schema.joinRequest);
    await tx.delete(schema.membership);
    await tx.delete(schema.workspaceSubscription);
    await tx.delete(schema.workspace);
    await tx.delete(schema.userProfile);
    await tx.delete(schema.session);
    await tx.delete(schema.account);
    await tx.delete(schema.verificationToken);
    await tx.delete(schema.user);
  });
}

export async function seedWorkspace() {
  const client = await getTestDb();
  const slug = `acme-${crypto.randomUUID().slice(0, 8)}`;
  const [workspace] = await client
    .insert(schema.workspace)
    .values({ name: "Acme", slug, hashtag: `#${slug}` })
    .returning();
  const [channel] = await client
    .insert(schema.channel)
    .values({ workspaceId: workspace!.id, name: "q3-launch" })
    .returning();
  return { workspace: workspace!, channel: channel! };
}

export async function seedUser(input?: {
  name?: string;
  email?: string;
  password?: string;
  onboarded?: boolean;
}) {
  const client = await getTestDb();
  const name = input?.name ?? "Test User";
  const email =
    input?.email?.toLowerCase() ??
    `test-${crypto.randomUUID()}@example.com`;
  const passwordHash = input?.password ?? "password123";

  const [user] = await client.transaction(async (tx) => {
    const [u] = await tx
      .insert(schema.user)
      .values({ name, email, passwordHash })
      .returning();
    await tx.insert(schema.userProfile).values({
      userId: u!.id,
      onboarded: input?.onboarded ?? false,
    });
    return [u!] as const;
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
  const client = await getTestDb();
  const { user, email, password } = await seedUser(input);

  let workspace: { id: string };
  let channel: { id: string };
  if (input?.workspaceId) {
    const ws = await client.query.workspace.findFirst({
      where: eq(schema.workspace.id, input.workspaceId),
    });
    if (!ws) throw new Error(`workspace ${input.workspaceId} not found`);
    const ch = await client.query.channel.findFirst({
      where: eq(schema.channel.workspaceId, ws.id),
    });
    if (!ch) throw new Error(`channel for workspace ${ws.id} not found`);
    workspace = ws;
    channel = ch;
  } else {
    const seeded = await seedWorkspace();
    workspace = seeded.workspace;
    channel = seeded.channel;
  }

  await client.insert(schema.membership).values({
    userId: user.id,
    workspaceId: workspace.id,
    role: "member",
  });

  return {
    user,
    email,
    password,
    workspaceId: workspace.id,
    workspace,
    channel,
  };
}

// Re-exported so tests can build typed IN-lists against array columns without
// importing drizzle-orm directly.
export { inArray };

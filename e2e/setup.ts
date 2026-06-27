import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "@drizzle/schema";

const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://e2e:e2e@127.0.0.1:5432/e2e?schema=public";

async function waitForDb(url: string, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const probe = new Pool({ connectionString: url, max: 1 });
    try {
      const client = await probe.connect();
      client.release();
      await probe.end();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    } finally {
      await probe.end().catch(() => {});
    }
  }
  throw new Error(`Timed out waiting for database at ${url}`);
}

async function main() {
  await waitForDb(E2E_DATABASE_URL);

  const pool = new Pool({ connectionString: E2E_DATABASE_URL });
  const db = drizzle(pool, { schema });

  try {
    await db.delete(schema.ritualSession);
    await db.delete(schema.task);
    await db.delete(schema.message);
    await db.delete(schema.channel);
    await db.delete(schema.membership);
    await db.delete(schema.workspaceSubscription);
    await db.delete(schema.workspace);
    await db.delete(schema.userProfile);
    await db.delete(schema.user).where(
      inArray(schema.user.email, [
        "maya@example.com",
        "daniel@example.com",
        "sofia@example.com",
        "theo@example.com",
        "priya@example.com",
      ])
    );

    const passwordHash = await bcrypt.hash("demo1234", 10);

    const userInputs = [
      {
        name: "Maya",
        email: "maya@example.com",
        profile: {
          role: "Product Manager",
          hardMoment: "Starting when a task feels vague",
          profileId: "curious-starter",
          onboarded: true,
          tone: "warm",
        },
      },
      { name: "Daniel", email: "daniel@example.com" },
      { name: "Sofía", email: "sofia@example.com" },
      { name: "Theo", email: "theo@example.com" },
      { name: "Priya", email: "priya@example.com" },
    ];

    const users = [];
    for (const u of userInputs) {
      const [created] = await db
        .insert(schema.user)
        .values({
          name: u.name,
          email: u.email,
          passwordHash,
        })
        .returning();
      if (u.profile) {
        await db.insert(schema.userProfile).values({
          userId: created!.id,
          role: u.profile.role,
          hardMoment: u.profile.hardMoment,
          profileId: u.profile.profileId,
          onboarded: u.profile.onboarded,
          tone: u.profile.tone,
        });
      }
      users.push(created!);
    }

    const maya = users.find((u) => u.email === "maya@example.com")!;
    const userMap = new Map(users.map((u) => [u.name, u.id]));

    const [workspace] = await db
      .insert(schema.workspace)
      .values({ name: "Acme", slug: "acme", hashtag: "#acme" })
      .returning();
    await db
      .insert(schema.membership)
      .values(users.map((u) => ({ userId: u.id, workspaceId: workspace!.id, role: "member" })));
    const [channel] = await db
      .insert(schema.channel)
      .values({ workspaceId: workspace!.id, name: "q3-launch" })
      .returning();

    const messages = await db
      .insert(schema.message)
      .values([
        {
          channelId: channel!.id,
          userId: userMap.get("Daniel")!,
          content: "Morning all ☀️ Q3 launch is officially a go.",
          createdAt: new Date(Date.now() - 4 * 60_000),
        },
        {
          channelId: channel!.id,
          userId: userMap.get("Sofía")!,
          content: "finally!! been waiting for this 🎉",
          createdAt: new Date(Date.now() - 3 * 60_000),
        },
        {
          channelId: channel!.id,
          userId: userMap.get("Theo")!,
          content: "love it. what’s the first domino?",
          createdAt: new Date(Date.now() - 2 * 60_000),
        },
        {
          channelId: channel!.id,
          userId: userMap.get("Daniel")!,
          content: "We want the launch deck ready before Thursday’s sync so marketing can build from it.",
          createdAt: new Date(Date.now() - 1 * 60_000),
        },
        {
          channelId: channel!.id,
          userId: userMap.get("Daniel")!,
          content: "Maya — could you pull together a first rough draft of the Q3 launch deck? Honestly even messy is perfect to start. 🙏",
          createdAt: new Date(),
        },
      ])
      .returning();

    const assignedMessage = messages.find((m) =>
      m.content.toLowerCase().includes("launch deck")
    );

    if (assignedMessage) {
      await db.insert(schema.task).values({
        userId: maya.id,
        messageId: assignedMessage.id,
        title: "Draft the Q3 launch deck",
        fromQuote: "“a first rough draft of the launch deck”",
        category: "Slides",
        app: "Acme Deck Hub",
        due: "before Thursday",
        load: "Medium",
        micro: "Open the deck and type one messy sentence. That’s the whole job.",
        action: "one messy sentence",
        resource: "Q 3 Launch Deck.key",
        selfMade: false,
        status: "open",
      });
    }

    console.log("✅ E2E seed complete");
  } catch (error) {
    console.error("E2E setup failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

export default main;

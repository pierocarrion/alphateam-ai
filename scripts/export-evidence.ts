import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, sum, count } from "drizzle-orm";
import * as schema from "@drizzle/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

async function main() {
  const [
    waitlistRows,
    userRows,
    taskRows,
    ritualRows,
    recoveredRows,
    feedback,
  ] = await Promise.all([
    db.select({ c: count() }).from(schema.waitlist),
    db.select({ c: count() }).from(schema.user),
    db.select({ c: count() }).from(schema.task),
    db.select({ c: count() }).from(schema.ritualSession),
    db.select({ total: sum(schema.userMetric.value) })
      .from(schema.userMetric)
      .where(eq(schema.userMetric.type, "recovered_minutes")),
    db.query.feedback.findMany({
      orderBy: desc(schema.feedback.createdAt),
      limit: 50,
      columns: {
        type: true,
        content: true,
        tags: true,
        metricValue: true,
        createdAt: true,
      },
    }),
  ]);

  const waitlistCount = Number(waitlistRows[0]?.c ?? 0);
  const userCount = Number(userRows[0]?.c ?? 0);
  const taskCount = Number(taskRows[0]?.c ?? 0);
  const ritualCount = Number(ritualRows[0]?.c ?? 0);
  const recoveredMinutes = Number(recoveredRows[0]?.total ?? 0);

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      waitlistCount,
      userCount,
      taskCount,
      ritualCount,
      recoveredMinutes,
      feedbackCount: feedback.length,
    },
    testimonials: feedback
      .filter((f) => f.type === "testimonial")
      .map((f) => ({ content: f.content, tags: f.tags, createdAt: f.createdAt })),
    wins: feedback
      .filter((f) => f.type === "win")
      .map((f) => ({ content: f.content, metricValue: f.metricValue, createdAt: f.createdAt })),
    struggles: feedback
      .filter((f) => f.type === "struggle")
      .map((f) => ({ content: f.content, createdAt: f.createdAt })),
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PGliteServer, hasSchema } from "prisma-pglite-bridge";

const PORT = Number(process.env.PGLITE_PORT ?? 5432);
const HOST = process.env.PGLITE_HOST ?? "127.0.0.1";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const initSqlPath = path.resolve(__dirname, "../drizzle/0000_init.sql");

const server = new PGliteServer({ host: HOST, port: PORT });
const url = await server.listen();
console.log(`[e2e-server] PGlite listening on ${url}`);

try {
  const already = await hasSchema(server.pglite);
  if (already) {
    console.log("[e2e-server] Schema already present, skipping migrations");
  } else {
    const sql = readFileSync(initSqlPath, "utf-8");
    await server.pglite.exec(sql);
    console.log("[e2e-server] Applied drizzle init schema");
  }
} catch (err) {
  console.error("[e2e-server] Schema setup failed:", err);
  await server.close();
  process.exit(1);
}

const child = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    DATABASE_URL: `postgresql://e2e:e2e@${HOST}:${PORT}/e2e?schema=public`,
  },
});

let exiting = false;
const shutdown = async (code) => {
  if (exiting) return;
  exiting = true;
  try {
    child.kill();
  } catch {
  }
  try {
    await server.close();
  } catch {
  }
  process.exit(typeof code === "number" ? code : 0);
};

child.on("exit", (code) => shutdown(code ?? 0));
process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

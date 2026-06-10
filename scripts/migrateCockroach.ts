/**
 * Run CockroachDB schema migration against COCKROACHDB_URL from .env.local.
 * Usage: pnpm exec tsx scripts/migrateCockroach.ts
 */
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const url = process.env.COCKROACHDB_URL;
  if (!url) {
    console.error("COCKROACHDB_URL is not set in .env.local");
    process.exit(1);
  }

  const hostMatch = url.match(/@([^/]+)/);
  console.log(`Connecting to ${hostMatch?.[1] ?? "unknown host"}…`);

  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: true },
  });

  try {
    const { rows } = await pool.query<{ db: string; user: string }>(
      "SELECT current_database() AS db, current_user AS user"
    );
    console.log(`Connected as ${rows[0]?.user} on database ${rows[0]?.db}`);

    const { runMigration } = await import("../lib/cockroachdb");
    await runMigration();
    console.log("Migration complete.");
  } finally {
    await pool.end();
  }
}

main().catch((err: Error) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});

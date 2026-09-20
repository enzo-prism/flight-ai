import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
const connection =
  process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!connection) throw new Error("Database connection is not configured.");
const url = new URL(connection);
url.searchParams.delete("sslmode");
url.searchParams.delete("pgbouncer");
url.searchParams.delete("connect_timeout");
const ca = process.env.POSTGRES_CA_PATH
  ? await readFile(process.env.POSTGRES_CA_PATH, "utf8")
  : undefined;
const db = new pg.Client({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
  connectionTimeoutMillis: 15000,
});
try {
  await db.connect();
  await db.query("BEGIN");
  await db.query(
    "SELECT pg_advisory_xact_lock(hashtext('mach1-product-migrations'))",
  );
  await db.query(
    "CREATE TABLE IF NOT EXISTS public.product_schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  await db.query(
    "REVOKE ALL ON public.product_schema_migrations FROM anon,authenticated",
  );
  // Serialize migration runners and apply every numbered migration in order.
  const directory = new URL("../db/", import.meta.url);
  const migrations = (await readdir(directory))
    .filter((name) => /^\d{3}_.*\.sql$/.test(name))
    .sort();
  const versions = new Set();
  for (const name of migrations) {
    const version = name.slice(0, 3);
    if (versions.has(version)) throw new Error("Duplicate migration version");
    versions.add(version);
    const exists = await db.query(
      "SELECT version FROM public.product_schema_migrations WHERE version=$1",
      [version],
    );
    if (exists.rowCount) {
      console.log(`Product schema ${version} already applied.`);
      continue;
    }
    await db.query(await readFile(new URL(name, directory), "utf8"));
    await db.query(
      "INSERT INTO public.product_schema_migrations(version) VALUES ($1)",
      [version],
    );
    console.log(`Product schema ${version} applied atomically.`);
  }
  await db.query("COMMIT");
  const checks = await db.query(
    "SELECT count(*)::int AS tables, bool_and(relrowsecurity) AS all_rls FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('product_workspaces','product_connections','product_connector_secrets','product_oauth_states','product_conversations','product_findings','product_runs')",
  );
  console.log(checks.rows[0]);
} catch (error) {
  await db.query("ROLLBACK").catch(() => {});
  console.error("Migration failed:", error.code || error.name);
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}

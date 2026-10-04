import { buildApp } from "./app.ts";
import { createPool, migrate } from "./db.ts";
import { seedReferenceData } from "./seed.ts";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://dune:dune@localhost:5432/dune_tournament";
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";

async function waitForDatabase(db: ReturnType<typeof createPool>, attempts = 30): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await db.query("SELECT 1");
      return;
    } catch (err) {
      if (i === attempts) throw err;
      console.log(`Waiting for database (${i}/${attempts})...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

async function main() {
  const db = createPool(DATABASE_URL);
  await waitForDatabase(db);
  const applied = await migrate(db);
  if (applied.length) console.log(`Applied migrations: ${applied.join(", ")}`);
  await seedReferenceData(db);

  if (!ADMIN_TOKEN) {
    console.warn("ADMIN_TOKEN is not set: anyone who can reach the API can change tournaments.");
  }

  const app = await buildApp({ db, adminToken: ADMIN_TOKEN, logger: true });
  await app.listen({ port: PORT, host: HOST });

  const shutdown = async () => {
    await app.close();
    await db.end();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

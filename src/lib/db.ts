import "server-only";
import { Pool } from "pg";

const globalForDb = globalThis as unknown as { dbPool?: Pool };

export function getDbPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Thiếu DATABASE_URL trong .env.local.");
  }

  if (!globalForDb.dbPool) {
    globalForDb.dbPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      connectionTimeoutMillis: 10000,
    });
  }

  return globalForDb.dbPool;
}

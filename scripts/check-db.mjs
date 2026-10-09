import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  console.error("Thiếu DATABASE_URL trong .env.local.");
  process.exitCode = 1;
} else {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await pool.query("SELECT 1");
    console.log("Đã kết nối PostgreSQL (Supabase) thành công.");
  } catch (error) {
    console.error("Kết nối PostgreSQL thất bại:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("No DATABASE_URL in .env.local");
  process.exit(1);
}

if (connectionString.includes(".pooler.supabase.com:6543")) {
  connectionString = connectionString.replace(":6543", ":5432");
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  console.log("=== DANH SÁCH BẢNG TRONG DATABASE ===");
  for (const row of tablesRes.rows) {
    console.log(`BẢNG: ${row.table_name}`);
  }

  const fkRes = await pool.query(`
    SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public';
  `);

  console.log("\n=== FOREIGN KEYS ===");
  for (const fk of fkRes.rows) {
    console.log(`${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
  }

} catch (err) {
  console.error("Lỗi:", err.message);
} finally {
  await pool.end();
}


import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

try {
  const { rows } = await pool.query(`
    SELECT table_schema, table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name ~* '(user|account|admin|staff|employee|tenant|building|property|session|role|permission|facility|site|branch|toa_nha|co_so|nguoi_dung|tai_khoan|nhan_vien|phan_quyen)'
        OR column_name ~* '(password|username|email|role|building_id|property_id|user_id)')
    ORDER BY table_schema, table_name, ordinal_position
  `);
  console.log(JSON.stringify(rows, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

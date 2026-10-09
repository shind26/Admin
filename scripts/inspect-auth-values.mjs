import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
try {
  const { rows } = await pool.query(`
    SELECT vai_tro, trang_thai, co_so_van_hanh,
      CASE
        WHEN mat_khau LIKE '$2a$%' OR mat_khau LIKE '$2b$%' OR mat_khau LIKE '$2y$%' THEN 'bcrypt'
        WHEN mat_khau LIKE '$argon2%' THEN 'argon2'
        WHEN mat_khau IS NULL THEN 'null'
        WHEN mat_khau ~ '^[a-fA-F0-9]{64}$' THEN 'hex-64'
        WHEN mat_khau ~ '^[a-fA-F0-9]{32}$' THEN 'hex-32'
        WHEN mat_khau LIKE 'pbkdf2:%' THEN 'pbkdf2'
        WHEN mat_khau LIKE '%$2a$%' OR mat_khau LIKE '%$2b$%' OR mat_khau LIKE '%$2y$%' THEN 'wrapped-bcrypt'
        WHEN mat_khau ~ '^\$[A-Za-z0-9_]+\$' THEN 'dollar-tag-' || split_part(mat_khau, '$', 2) || '-length-' || length(mat_khau)::text
        ELSE 'other-length-' || length(mat_khau)::text || '-prefix-code-' || ascii(left(mat_khau, 1))::text
      END AS hash_format,
      count(*)::integer AS account_count
    FROM public.tai_khoan
    GROUP BY vai_tro, trang_thai, co_so_van_hanh, hash_format
    ORDER BY account_count DESC
  `);
  console.log(JSON.stringify(rows, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

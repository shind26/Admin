import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  const { rows } = await pool.query(
    `SELECT ten_dang_nhap, vai_tro, co_so_van_hanh, phai_doi_mat_khau
     FROM public.tai_khoan
     WHERE vai_tro IN ('Admin', 'QuanLy')
     ORDER BY ten_dang_nhap`,
  );
  for (const row of rows) console.log(JSON.stringify(row));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

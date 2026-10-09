import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const value = process.argv[2] === "on";

try {
  const { rowCount } = await pool.query(
    "UPDATE public.tai_khoan SET phai_doi_mat_khau = $1 WHERE ten_dang_nhap = $2",
    [value, "quanly@kieugiang.vn"],
  );
  console.log(`updated ${rowCount} row(s) -> phai_doi_mat_khau = ${value}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

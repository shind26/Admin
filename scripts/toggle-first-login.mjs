import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const forceChange = process.argv.includes("--on");
const daDoiMatKhau = !forceChange;

try {
  const { rows } = await pool.query(
    `UPDATE public.tai_khoan SET da_doi_mat_khau = $1
     WHERE ten_dang_nhap = 'quanly@kieugiang.vn'
     RETURNING ten_dang_nhap, vai_tro, co_so_van_hanh, da_doi_mat_khau`,
    [daDoiMatKhau],
  );
  console.log("Da cap nhat:", JSON.stringify(rows[0]));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

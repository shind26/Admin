import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const cases = [
  { label: "Admin (toàn quyền)", building: null },
  { label: "QuanLy Tòa A", building: "Tòa A" },
];

try {
  for (const item of cases) {
    const rooms = await pool.query(
      `SELECT COUNT(*)::int AS n FROM public.phong p
       WHERE ($1::text IS NULL OR p.toa_nha = $1)`,
      [item.building],
    );
    const tenants = await pool.query(
      `SELECT COUNT(DISTINCT k.ma_khach)::int AS n
       FROM public.khach_thue k
       LEFT JOIN public.hop_dong hd ON hd.ma_khach_dai_dien = k.ma_khach
       LEFT JOIN public.phong p ON p.ma_phong = hd.ma_phong
       WHERE ($1::text IS NULL OR p.toa_nha = $1)`,
      [item.building],
    );
    const buildings = await pool.query(
      `SELECT array_agg(DISTINCT toa_nha) AS items FROM public.phong
       WHERE ($1::text IS NULL OR toa_nha = $1)`,
      [item.building],
    );
    console.log(
      JSON.stringify({
        label: item.label,
        soPhong: rooms.rows[0].n,
        soKhachThue: tenants.rows[0].n,
        toaThayDuoc: buildings.rows[0].items,
      }),
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

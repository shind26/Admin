import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("1. Adding columns chi_so_dien, chi_so_nuoc, ngay_cap_nhat_chi_so to public.phong...");
    await client.query(`
      ALTER TABLE public.phong 
      ADD COLUMN IF NOT EXISTS chi_so_dien NUMERIC(10, 2) DEFAULT 0 NOT NULL,
      ADD COLUMN IF NOT EXISTS chi_so_nuoc NUMERIC(10, 2) DEFAULT 0 NOT NULL,
      ADD COLUMN IF NOT EXISTS ngay_cap_nhat_chi_so TIMESTAMPTZ DEFAULT NOW();
    `);

    console.log("2. Backfilling latest meter readings from chi_so_dien_nuoc into public.phong...");
    const updateResult = await client.query(`
      UPDATE public.phong p
      SET 
        chi_so_dien = COALESCE(sub.chi_so_dien_moi, p.chi_so_dien, 0),
        chi_so_nuoc = COALESCE(sub.chi_so_nuoc_moi, p.chi_so_nuoc, 0),
        ngay_cap_nhat_chi_so = COALESCE(sub.ngay_ghi_nhan, NOW())
      FROM (
        SELECT DISTINCT ON (hd.ma_phong)
          hd.ma_phong,
          cs.chi_so_dien_moi,
          cs.chi_so_nuoc_moi,
          cs.ngay_ghi_nhan
        FROM public.chi_so_dien_nuoc cs
        JOIN public.hop_dong hd ON hd.ma_hop_dong = cs.ma_hop_dong
        WHERE cs.chi_so_dien_moi IS NOT NULL OR cs.chi_so_nuoc_moi IS NOT NULL
        ORDER BY hd.ma_phong, cs.ngay_ghi_nhan DESC NULLS LAST, cs.thang_nam DESC NULLS LAST
      ) sub
      WHERE p.ma_phong = sub.ma_phong;
    `);

    console.log(`Updated ${updateResult.rowCount} rooms with latest meter readings.`);

    await client.query("COMMIT");

    const sample = await client.query(`
      SELECT ma_phong, ten_hien_thi, chi_so_dien, chi_so_nuoc, ngay_cap_nhat_chi_so 
      FROM public.phong 
      LIMIT 10
    `);
    console.log("Sample rooms after migration:");
    console.table(sample.rows);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();


import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log("Ensuring public.yeu_cau_chuyen_phong table exists...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.yeu_cau_chuyen_phong (
      ma_yeu_cau varchar(50) PRIMARY KEY,
      ma_hop_dong_ht varchar(50) REFERENCES public.hop_dong(ma_hop_dong) ON DELETE CASCADE,
      ma_phong_cu varchar(50),
      ma_phong_moi varchar(50),
      tien_coc_bao_luu numeric DEFAULT 0,
      thoi_gian_hen date,
      ly_do_chuyen text,
      trang_thai_tien_do varchar(50) DEFAULT 'CHO_DUYET',
      trang_thai varchar(50) DEFAULT 'CHO_DUYET',
      tien_dien_nuoc_cu numeric DEFAULT 0,
      tien_hu_hai_cu numeric DEFAULT 0,
      tien_phat_sinh numeric DEFAULT 0,
      ghi_chu_hu_hai text,
      nguoi_don_bql varchar(100) DEFAULT 'BQL Kiều Giang',
      ngay_tao timestamp with time zone DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_yccp_hop_dong ON public.yeu_cau_chuyen_phong(ma_hop_dong_ht);
    CREATE INDEX IF NOT EXISTS idx_yccp_trang_thai ON public.yeu_cau_chuyen_phong(trang_thai_tien_do);
  `);

  console.log("Table public.yeu_cau_chuyen_phong ensured successfully.");
  await pool.end();
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});


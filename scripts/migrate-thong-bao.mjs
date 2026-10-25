import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log("Creating public.thong_bao table...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.thong_bao (
      ma_thong_bao varchar(50) PRIMARY KEY,
      ma_tai_khoan varchar(50) REFERENCES public.tai_khoan(ma_tai_khoan) ON DELETE CASCADE,
      ma_phong varchar(50) REFERENCES public.phong(ma_phong) ON DELETE CASCADE,
      toa_nha varchar(100),
      tieu_de varchar(255) NOT NULL,
      noi_dung text NOT NULL,
      loai_thong_bao varchar(50) NOT NULL, -- 'TaiKhoan', 'HoaDon', 'SuCo', 'HopDong', 'ToaNha', 'Xe', 'BanGiao'
      du_lieu_dinh_kem jsonb,
      da_doc boolean DEFAULT false,
      ngay_tao timestamp with time zone DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_thong_bao_tai_khoan ON public.thong_bao(ma_tai_khoan);
    CREATE INDEX IF NOT EXISTS idx_thong_bao_phong ON public.thong_bao(ma_phong);
    CREATE INDEX IF NOT EXISTS idx_thong_bao_ngay_tao ON public.thong_bao(ngay_tao DESC);
  `);

  console.log("Table public.thong_bao created successfully.");
  await pool.end();
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});


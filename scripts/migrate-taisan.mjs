import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  console.log("Upgrading tai_san table schema...");

  await pool.query(`
    ALTER TABLE public.tai_san
      ADD COLUMN IF NOT EXISTS so_luong INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS thuong_hieu VARCHAR(150),
      ADD COLUMN IF NOT EXISTS so_serial VARCHAR(100),
      ADD COLUMN IF NOT EXISTS gia_tri NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ghi_chu TEXT,
      ADD COLUMN IF NOT EXISTS ngay_trang_bi DATE DEFAULT CURRENT_DATE;
  `);

  console.log("Schema upgraded successfully!");

  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tai_san'
    ORDER BY ordinal_position
  `);
  console.log("Updated columns of tai_san:", cols.rows);

  await pool.end();
}

run().catch(console.error);


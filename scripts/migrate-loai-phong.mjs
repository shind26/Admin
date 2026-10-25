import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  console.log("Migrating loai_phong table with tien_ich column...");

  await pool.query(`
    ALTER TABLE public.loai_phong
      ADD COLUMN IF NOT EXISTS tien_ich TEXT[];
  `);

  await pool.query(`
    UPDATE public.loai_phong
    SET tien_ich = ARRAY[
      'Gác lửng đúc kiên cố',
      'Wifi tốc độ cao',
      'Chỗ để xe máy',
      'Khóa vân tay an ninh',
      'Giờ giấc tự do',
      'Camera an ninh 24/7'
    ]
    WHERE ma_loai_phong = 'LP_GAC';

    UPDATE public.loai_phong
    SET tien_ich = ARRAY[
      'Ban công riêng thoáng mát',
      'Cửa kính lấy sáng tự nhiên',
      'Wifi tốc độ cao',
      'Chỗ để xe máy',
      'Khóa vân tay an ninh',
      'Giờ giấc tự do'
    ]
    WHERE ma_loai_phong = 'LP_BC';

    UPDATE public.loai_phong
    SET tien_ich = ARRAY[
      'Cửa sổ Panorama view thoáng',
      'Thang máy di chuyển',
      'Khóa thông minh vân tay',
      'Wifi riêng từng phòng',
      'Chỗ để xe ô tô & xe máy',
      'Camera an ninh 24/7',
      'Giờ giấc tự do không chung chủ'
    ]
    WHERE ma_loai_phong = 'LP_STD';

    UPDATE public.loai_phong
    SET tien_ich = ARRAY[
      'Wifi tốc độ cao',
      'Chỗ để xe máy',
      'Khóa vân tay an ninh',
      'Khu giặt phơi chung',
      'Giờ giấc tự do'
    ]
    WHERE ma_loai_phong = 'LP_TIET';
  `);

  const res = await pool.query(`SELECT ma_loai_phong, ten_loai_phong, tien_ich FROM public.loai_phong`);
  console.log("Updated loai_phong with amenities:", res.rows);

  await pool.end();
}

run().catch(console.error);


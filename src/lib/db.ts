import "server-only";
import { Pool } from "pg";

const globalForDb = globalThis as unknown as { dbPool?: Pool };

export function getDbPool(): Pool {
  let connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Thiếu DATABASE_URL trong .env.local.");
  }

  // Supabase Pooler: Cổng 6543 là Transaction mode (chuẩn khuyến nghị của Supabase cho môi trường Serverless / Vercel).
  // Cổng 5432 (Session mode) bị Supabase giới hạn tối đa 15 kết nối (EMAXCONNSESSION) khiến Vercel bị sập khi nhiều truy vấn chạy đồng thời.
  // Tự động chuyển sang cổng 6543 nếu đang dùng 5432 trên pooler.
  if (connectionString.includes(".pooler.supabase.com:5432")) {
    connectionString = connectionString.replace(":5432", ":6543");
  }

  if (!globalForDb.dbPool) {
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      // Chừa kết nối cho ứng dụng cư dân trong giới hạn Supabase session pool (15).
      // pg tự xếp hàng các truy vấn vượt giới hạn thay vì mở thêm kết nối.
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    // Bắt sự kiện lỗi khi kết nối nhàn rỗi (idle) bị Supabase PgBouncer ngắt để không làm crash Node process
    pool.on("error", (err) => {
      console.warn("PostgreSQL Pool idle client:", err.message);
    });

    globalForDb.dbPool = pool;
  }

  return globalForDb.dbPool;
}

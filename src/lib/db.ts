import "server-only";
import { Pool } from "pg";

const globalForDb = globalThis as unknown as { dbPool?: Pool };

export function getDbPool(): Pool {
  let connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Thiếu DATABASE_URL trong .env.local.");
  }

  // Supabase Pooler: cổng 6543 là Transaction mode (ngắt kết nối khi socket nhàn rỗi).
  // Tự động chuyển sang 5432 (Session mode) theo đúng khuyến nghị để pool hoạt động bền bỉ.
  if (connectionString.includes(".pooler.supabase.com:6543")) {
    connectionString = connectionString.replace(":6543", ":5432");
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

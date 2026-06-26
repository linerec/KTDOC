import mysql from 'mysql2/promise';

// Next.js dev의 HMR은 이 모듈을 반복 재평가한다. globalThis에 캐싱하지 않으면
// 재평가마다 새 풀이 생겨 커넥션이 누적되고 MySQL "Too many connections"가 발생한다.
// 프로덕션(서버리스 인스턴스 재사용)에서도 단일 풀을 보장하기 위해 항상 캐싱한다.
const globalForDb = globalThis as unknown as { _ktdocPool?: mysql.Pool };

const pool =
  globalForDb._ktdocPool ??
  mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // 유휴 커넥션을 일정 시간 후 닫아 서버 측 커넥션 누적을 줄인다.
    maxIdle: 4,
    idleTimeout: 60000,
    // 원격 DB가 유휴 커넥션을 끊어 ECONNRESET이 나는 것을 줄인다.
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });

globalForDb._ktdocPool = pool;

export default pool;

// 풀이 죽은(서버가 끊은) 커넥션을 내줄 때 나는 일시적 오류 — 한 번 재시도하면 새 커넥션으로 성공한다.
const TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'PROTOCOL_CONNECTION_LOST',
  'EPIPE',
  'ETIMEDOUT',
]);

function isTransientError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code && TRANSIENT_CODES.has(e.code)) return true;
  return /ECONNRESET|connection lost|read ETIMEDOUT/i.test(e.message || '');
}

export async function query<T>(sql: string, params?: unknown[]): Promise<T> {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows as T;
  } catch (err) {
    if (isTransientError(err)) {
      // 끊긴 커넥션 한 번 재시도(다음 호출은 새 커넥션을 받는다)
      const [rows] = await pool.execute(sql, params);
      return rows as T;
    }
    throw err;
  }
}

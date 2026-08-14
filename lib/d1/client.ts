/**
 * Cloudflare D1 Client
 * REST API를 통한 D1 데이터베이스 접근
 */

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;

interface D1Response<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result: Array<{
    results: T[];
    success: boolean;
    meta: {
      changed_db: boolean;
      changes: number;
      duration: number;
      last_row_id: number;
      rows_read: number;
      rows_written: number;
    };
  }>;
}

/**
 * D1 데이터베이스에 쿼리 실행
 */
export async function queryD1<T>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !D1_DATABASE_ID) {
    throw new Error('D1 configuration missing. Check environment variables.');
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql,
        params,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`D1 API error (${response.status}): ${text}`);
  }

  const text = await response.text();
  if (!text) {
    throw new Error('D1 API returned empty response');
  }

  let data: D1Response<T>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`D1 API returned invalid JSON: ${text.substring(0, 200)}`);
  }

  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || 'D1 query failed';
    throw new Error(errorMessage);
  }

  return data.result[0]?.results || [];
}

/**
 * D1 데이터베이스에 실행 쿼리 (INSERT, UPDATE, DELETE)
 */
export async function executeD1(
  sql: string,
  params: unknown[] = []
): Promise<{ changes: number; lastRowId: number }> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !D1_DATABASE_ID) {
    throw new Error('D1 configuration missing. Check environment variables.');
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql,
        params,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`D1 API error (${response.status}): ${text}`);
  }

  const text = await response.text();
  if (!text) {
    throw new Error('D1 API returned empty response');
  }

  let data: D1Response<unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`D1 API returned invalid JSON: ${text.substring(0, 200)}`);
  }

  if (!data.success) {
    const errorMessage = data.errors?.[0]?.message || 'D1 execution failed';
    throw new Error(errorMessage);
  }

  const meta = data.result[0]?.meta;
  return {
    changes: meta?.changes || 0,
    lastRowId: meta?.last_row_id || 0,
  };
}

/**
 * D1 연결 상태 확인
 */
export async function checkD1Connection(): Promise<boolean> {
  try {
    await queryD1('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * 여러 문장을 순차 실행한다.
 *
 * ⚠️ **롤백이 없다.** D1은 BEGIN/COMMIT을 거부하므로(실측: "use state.storage.transaction()")
 * 중간에 실패하면 앞의 문장은 이미 반영된 상태로 남는다. 그래서 이 함수의 호출부는
 * "실패해도 재계산으로 복구되는 쓰기"로 제한한다 — 지금은 신청서 파생 테이블
 * INSERT 한 곳뿐이다(lib/d1/formResponses.ts).
 *
 * 응답 본체처럼 원자성이 필요한 쓰기에는 절대 쓰지 말 것. 단일 INSERT로 착지시킨다.
 */
export async function batchD1(
  statements: Array<{ sql: string; params?: unknown[] }>
): Promise<void> {
  for (const s of statements) {
    await executeD1(s.sql, s.params ?? []);
  }
}

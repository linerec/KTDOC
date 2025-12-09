# Cloudflare D1 데이터베이스 설정 가이드

이 문서는 Cloudflare D1을 서버리스 SQL 데이터베이스로 사용하는 방법에 대한 가이드입니다.

## 📋 목차

1. [개요](#개요)
2. [환경 설정](#환경-설정)
3. [데이터베이스 생성](#데이터베이스-생성)
4. [스키마 및 마이그레이션](#스키마-및-마이그레이션)
5. [Workers에서 사용법](#workers에서-사용법)
6. [Next.js 통합](#nextjs-통합)
7. [Time Travel (백업)](#time-travel-백업)
8. [제한사항](#제한사항)
9. [문제 해결](#문제-해결)

## 개요

### 왜 Cloudflare D1인가?

- **서버리스 SQL**: 인프라 관리 없이 SQLite 기반 데이터베이스 사용
- **글로벌 분산**: Cloudflare 엣지 네트워크에서 저지연 액세스
- **Time Travel**: 30일간 자동 백업 및 특정 시점 복원 가능
- **비용 효율적**: 무료 플랜에서도 사용 가능
- **SQLite 호환**: 익숙한 SQL 문법 사용

### D1 vs 기존 MySQL (AWS RDS)

| 특성 | Cloudflare D1 | AWS RDS MySQL |
|------|---------------|---------------|
| 관리 | 완전 서버리스 | 인스턴스 관리 필요 |
| 비용 | 무료 티어 제공 | 시간당 과금 |
| 지연시간 | 엣지에서 저지연 | 리전 기반 |
| 백업 | Time Travel (30일) | 수동/자동 스냅샷 |
| 용량 | 10GB/데이터베이스 | 무제한 (비용 증가) |
| 적합한 용도 | 엣지 애플리케이션, 읽기 중심 | 복잡한 트랜잭션, 대용량 |

### 프로젝트 구조 (예정)

```
src/
├── lib/d1/
│   ├── client.ts         # D1 클라이언트 설정
│   ├── queries.ts        # 쿼리 유틸리티 함수
│   └── index.ts          # Export 정리
├── app/api/d1/
│   └── [...route]/
│       └── route.ts      # D1 API 라우트
└── migrations/
    └── 0001_initial.sql  # 마이그레이션 파일
```

## 환경 설정

### 1. Wrangler CLI 설치

```bash
npm install -g wrangler

# 또는 프로젝트 로컬 설치
npm install --save-dev wrangler
```

### 2. Cloudflare 로그인

```bash
wrangler login
```

브라우저가 열리면 Cloudflare 계정으로 로그인합니다.

### 3. wrangler.toml 설정

프로젝트 루트에 `wrangler.toml` 파일 생성:

```toml
name = "ktdoc"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "ktdoc-db"
database_id = "<YOUR_DATABASE_ID>"
```

### 4. 환경 변수 (선택사항)

`.env.local`에 추가 (로컬 개발용):

```env
# Cloudflare D1 Configuration
CLOUDFLARE_ACCOUNT_ID=<your-account-id>
CLOUDFLARE_API_TOKEN=<your-api-token>
D1_DATABASE_ID=<your-database-id>
```

## 데이터베이스 생성

### 1. D1 데이터베이스 생성

```bash
wrangler d1 create ktdoc-db
```

출력 예시:
```
✅ Successfully created DB 'ktdoc-db' in region APAC
Created your new D1 database.

[[d1_databases]]
binding = "DB"
database_name = "ktdoc-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2. wrangler.toml 업데이트

출력된 `database_id`를 `wrangler.toml`에 추가합니다.

### 3. 데이터베이스 확인

```bash
# 데이터베이스 목록 확인
wrangler d1 list

# 특정 데이터베이스 정보
wrangler d1 info ktdoc-db
```

## 스키마 및 마이그레이션

### 1. 마이그레이션 파일 생성

`migrations/0001_initial.sql`:

```sql
-- 다국어 콘텐츠 테이블
CREATE TABLE IF NOT EXISTS locale_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keycode TEXT NOT NULL UNIQUE,
  ko TEXT,
  en TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 인덱스 생성
CREATE INDEX idx_locale_keycode ON locale_content(keycode);

-- 초기 데이터
INSERT INTO locale_content (keycode, ko, en) VALUES
  ('site.title', 'KTDOC - 한국 전통 공연', 'KTDOC - Korean Traditional Performance'),
  ('nav.home', '홈', 'Home'),
  ('nav.about', '소개', 'About'),
  ('nav.classes', '수업 & 프로그램', 'Classes & Programs'),
  ('nav.performances', '공연', 'Performances'),
  ('nav.gallery', '갤러리', 'Gallery');
```

### 2. 마이그레이션 실행

```bash
# 로컬 개발 데이터베이스에 적용
wrangler d1 execute ktdoc-db --local --file=./migrations/0001_initial.sql

# 프로덕션 데이터베이스에 적용
wrangler d1 execute ktdoc-db --remote --file=./migrations/0001_initial.sql
```

### 3. 데이터 확인

```bash
# 로컬 쿼리
wrangler d1 execute ktdoc-db --local --command="SELECT * FROM locale_content"

# 프로덕션 쿼리
wrangler d1 execute ktdoc-db --remote --command="SELECT * FROM locale_content"
```

## Workers에서 사용법

### Cloudflare Workers에서 D1 사용

```typescript
// src/worker.ts
export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/locale') {
      // 모든 로케일 데이터 조회
      const { results } = await env.DB.prepare(
        'SELECT * FROM locale_content'
      ).all();

      return Response.json({ success: true, data: results });
    }

    if (url.pathname.startsWith('/api/locale/')) {
      const keycode = url.pathname.replace('/api/locale/', '');

      // 특정 키코드 조회
      const result = await env.DB.prepare(
        'SELECT * FROM locale_content WHERE keycode = ?'
      ).bind(keycode).first();

      if (!result) {
        return Response.json({ success: false, error: 'Not found' }, { status: 404 });
      }

      return Response.json({ success: true, data: result });
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

### 쿼리 패턴

```typescript
// 단일 행 조회
const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
  .bind(userId)
  .first();

// 여러 행 조회
const { results } = await env.DB.prepare('SELECT * FROM users WHERE role = ?')
  .bind('admin')
  .all();

// 삽입
const { success, meta } = await env.DB.prepare(
  'INSERT INTO users (name, email) VALUES (?, ?)'
).bind(name, email).run();

// 업데이트
await env.DB.prepare(
  'UPDATE users SET name = ? WHERE id = ?'
).bind(newName, userId).run();

// 삭제
await env.DB.prepare('DELETE FROM users WHERE id = ?')
  .bind(userId)
  .run();

// 배치 실행 (트랜잭션)
const batchResults = await env.DB.batch([
  env.DB.prepare('INSERT INTO users (name) VALUES (?)').bind('Alice'),
  env.DB.prepare('INSERT INTO users (name) VALUES (?)').bind('Bob'),
]);
```

## Next.js 통합

### 방법 1: API Route를 통한 Workers 호출

```typescript
// app/api/d1/route.ts
import { NextResponse } from 'next/server';

const WORKER_URL = process.env.D1_WORKER_URL || 'https://your-worker.your-subdomain.workers.dev';

export async function GET() {
  try {
    const response = await fetch(`${WORKER_URL}/api/locale`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch from D1' },
      { status: 500 }
    );
  }
}
```

### 방법 2: Cloudflare Pages Functions (권장)

Next.js를 Cloudflare Pages에 배포할 경우, Pages Functions에서 직접 D1에 접근할 수 있습니다.

```typescript
// functions/api/locale.ts
interface Env {
  DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { results } = await context.env.DB.prepare(
    'SELECT * FROM locale_content'
  ).all();

  return Response.json({ success: true, data: results });
};
```

### 방법 3: REST API 사용 (외부 접근)

```typescript
// lib/d1/client.ts
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;

export async function queryD1<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql,
        params,
      }),
    }
  );

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.errors?.[0]?.message || 'D1 query failed');
  }

  return data.result[0]?.results || [];
}

// 사용 예시
const locales = await queryD1<LocaleContent>(
  'SELECT * FROM locale_content WHERE keycode = ?',
  ['site.title']
);
```

## Time Travel (백업)

D1은 자동으로 30일간의 백업을 유지하며, 특정 시점으로 복원할 수 있습니다.

### 1. 북마크 생성

```bash
# 현재 상태 북마크
wrangler d1 time-travel ktdoc-db bookmark create --name="before-migration"
```

### 2. 북마크 목록 확인

```bash
wrangler d1 time-travel ktdoc-db bookmark list
```

### 3. 특정 시점으로 복원

```bash
# 북마크로 복원
wrangler d1 time-travel ktdoc-db restore --bookmark=<bookmark-id>

# 타임스탬프로 복원
wrangler d1 time-travel ktdoc-db restore --timestamp="2024-01-15T10:30:00Z"
```

### 4. 특정 시점 데이터 조회 (복원 없이)

```bash
wrangler d1 execute ktdoc-db --remote \
  --command="SELECT * FROM locale_content" \
  --timestamp="2024-01-15T10:30:00Z"
```

## 제한사항

### 플랜별 제한

| 제한 | Workers Free | Workers Paid |
|------|--------------|--------------|
| 읽기 쿼리/일 | 5백만 | 250억 |
| 쓰기 쿼리/일 | 10만 | 5천만 |
| 스토리지 | 5GB | 50GB (추가 가능) |
| 데이터베이스 수 | 10개 | 50,000개 |
| 최대 DB 크기 | 2GB | 10GB |
| Time Travel 기간 | 30일 | 30일 |

### 기술적 제한

1. **행 크기**: 최대 2MB (BLOB/TEXT 포함)
2. **쿼리 크기**: 최대 100KB
3. **바인딩 수**: 쿼리당 최대 100개
4. **배치 쿼리**: 트랜잭션당 최대 1000개 쿼리
5. **동시 연결**: 제한 없음 (서버리스)

### SQLite vs MySQL 차이점

```sql
-- MySQL
AUTO_INCREMENT
NOW()
ENUM 타입 지원

-- SQLite (D1)
AUTOINCREMENT
datetime('now')
ENUM 미지원 (CHECK 제약조건 사용)
```

## 문제 해결

### 연결 문제

1. **wrangler 로그인 확인**:
   ```bash
   wrangler whoami
   ```

2. **database_id 확인**:
   ```bash
   wrangler d1 list
   ```

3. **wrangler.toml 바인딩 확인**:
   - `binding`, `database_name`, `database_id`가 올바른지 확인

### 쿼리 오류

1. **SQL 문법 오류**:
   ```bash
   # 로컬에서 먼저 테스트
   wrangler d1 execute ktdoc-db --local --command="YOUR SQL"
   ```

2. **타입 불일치**:
   - SQLite는 동적 타입이므로 명시적 캐스팅 필요할 수 있음

### 마이그레이션 실패

1. **마이그레이션 상태 확인**:
   ```bash
   wrangler d1 migrations list ktdoc-db
   ```

2. **롤백 필요시**:
   ```bash
   wrangler d1 time-travel ktdoc-db restore --bookmark=<before-migration-bookmark>
   ```

### 성능 최적화

1. **인덱스 생성**:
   ```sql
   CREATE INDEX idx_column ON table_name(column_name);
   ```

2. **쿼리 분석**:
   ```sql
   EXPLAIN QUERY PLAN SELECT * FROM table WHERE column = 'value';
   ```

3. **배치 처리 사용**:
   ```typescript
   // 여러 쿼리를 하나의 트랜잭션으로
   await env.DB.batch([query1, query2, query3]);
   ```

## 다음 단계

1. **D1 데이터베이스 생성**:
   - `wrangler d1 create ktdoc-db` 실행

2. **마이그레이션 설정**:
   - `migrations/` 디렉토리에 SQL 파일 작성

3. **Workers/Pages Functions 설정**:
   - API 엔드포인트 구현

4. **Next.js 통합**:
   - D1 클라이언트 라이브러리 생성

5. **IntlObject 시스템 마이그레이션** (선택):
   - 현재 JSON 파일 기반 → D1 데이터베이스로 이전

## 참고 자료

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [D1 REST API](https://developers.cloudflare.com/api/operations/cloudflare-d1-query-database)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/#d1)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)

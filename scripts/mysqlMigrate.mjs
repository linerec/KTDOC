#!/usr/bin/env node
/**
 * MySQL 원격 마이그레이션 러너
 *
 * 앱과 동일한 자격증명(DB_HOST·DB_PORT·DB_USER·DB_PASSWORD·DB_NAME)으로
 * 마이그레이션 .sql을 한 문장씩 실행한다. MySQL은 dev/prod 공유 원격이라
 * 한 번 실행하면 양쪽에 반영된다.
 *
 * - 멱등: CREATE TABLE/INDEX 는 IF NOT EXISTS 로 작성. ALTER ... ADD COLUMN 재실행 시
 *   "Duplicate column name", 인덱스 중복 등은 이미 적용된 것으로 보고 통과한다.
 * - 이 프로젝트 마이그레이션엔 문자열 내부의 ';'·'--' 가 없어 단순 분리로 충분하다.
 *
 * 사용: node scripts/mysqlMigrate.mjs migrations/0013_push_subscriptions.sql [추가.sql ...]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import mysql from 'mysql2/promise';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv(file) {
  let text;
  try {
    text = readFileSync(join(root, file), 'utf8');
  } catch {
    return;
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv('.env.local');

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
if (!DB_HOST || !DB_USER || !DB_NAME) {
  console.error('MySQL 설정 누락: DB_HOST·DB_USER·DB_NAME(.env.local) 확인.');
  process.exit(1);
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('사용: node scripts/mysqlMigrate.mjs <migration.sql> [추가.sql ...]');
  process.exit(1);
}

// 이미 적용된 상태에서 재실행해도 안전하게 통과시킬 오류 메시지(멱등성).
const IGNORABLE = /already exists|duplicate column name|duplicate key name|Duplicate foreign key/i;

const conn = await mysql.createConnection({
  host: DB_HOST,
  port: parseInt(DB_PORT || '3306'),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  multipleStatements: false,
});

try {
  for (const file of files) {
    const sqlText = readFileSync(resolve(root, file), 'utf8');
    const statements = sqlText
      .split('\n')
      .map((l) => l.replace(/--.*$/, ''))
      .join('\n')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`\n대상: 원격 MySQL (${file}) — 문장 ${statements.length}개`);

    for (const [i, stmt] of statements.entries()) {
      const label = `[${i + 1}/${statements.length}] ${stmt.replace(/\s+/g, ' ').slice(0, 70)}...`;
      try {
        await conn.query(stmt);
        console.log(`OK   ${label}`);
      } catch (err) {
        if (IGNORABLE.test(err.message || '')) {
          console.log(`SKIP ${label}  (이미 적용됨: ${err.message})`);
          continue;
        }
        console.error(`FAIL ${label}\n     ${err.message}`);
        process.exit(1);
      }
    }
  }
  console.log('\n완료. 원격 MySQL 마이그레이션이 적용되었습니다.');
} finally {
  await conn.end();
}

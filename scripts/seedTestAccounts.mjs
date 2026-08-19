#!/usr/bin/env node
/**
 * 테스트(샘플) 계정 시드 — 원생·선생님·학부모 고정 계정을 생성/리셋한다.
 *
 * 특징:
 *  - 멱등: 이메일 기준 upsert. 매 실행마다 비밀번호를 게시값으로 리셋하고 status=active 보장.
 *  - 학부모는 자녀(테스트 원생)와 student_guardians로 연결한다(원생을 먼저 시드).
 *  - 데이터 단일 출처: lib/testAccounts.json (회원 관리 화면 게시 패널과 공유).
 *
 * 실행: npm run seed:test   (또는 node scripts/seedTestAccounts.mjs)
 * 대상 DB: .env.local 의 DB_* (운영과 동일한 원격 MySQL).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Next는 .env.local을 자동 로드하지만, standalone 스크립트는 직접 읽어 process.env에 채운다.
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

const accounts = JSON.parse(readFileSync(join(root, 'lib/testAccounts.json'), 'utf8'));

const mysql = (await import('mysql2/promise')).default;
const bcrypt = (await import('bcryptjs')).default;

if (!process.env.DB_HOST) {
  console.error('DB_HOST가 비어 있습니다. .env.local을 확인하세요.');
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function q(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/** 이메일 기준 upsert. 비밀번호·역할·상태(active)·이름·입학년도를 항상 게시값으로 맞춘다. */
async function upsertUser(acc) {
  const hash = await bcrypt.hash(acc.password, 12);
  const existing = await q('SELECT id FROM users WHERE email = ?', [acc.email]);
  if (existing.length) {
    const id = existing[0].id;
    await q(
      `UPDATE users
         SET password_hash = ?, name = ?, role = ?, status = 'active', enrollment_year = ?
       WHERE id = ?`,
      [hash, acc.name, acc.role, acc.enrollmentYear ?? null, id]
    );
    return { id, created: false };
  }
  const id = randomUUID();
  await q(
    `INSERT INTO users (id, email, password_hash, name, role, status, enrollment_year)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`,
    [id, acc.email, hash, acc.name, acc.role, acc.enrollmentYear ?? null]
  );
  return { id, created: true };
}

/** 학부모↔원생 연결(student_guardians). 자녀를 이름+입학년도로 찾아 연결한다. */
async function linkGuardian(parentId, acc) {
  const students = await q(
    `SELECT id FROM users WHERE role = 'student' AND name = ? AND enrollment_year = ?`,
    [acc.childName, acc.childEnrollmentYear ?? null]
  );
  const studentId = students.length === 1 ? students[0].id : null;

  // 이 자녀(이름 기준)의 연결 행만 다룬다 — guardian_id 전체를 갱신하면
  // 다자녀 학부모의 다른 자녀 연결을 몽땅 덮어쓴다(형제자매 지원과 충돌).
  const links = await q(
    'SELECT id FROM student_guardians WHERE guardian_id = ? AND claimed_student_name = ?',
    [parentId, acc.childName]
  );
  if (!links.length) {
    await q(
      `INSERT INTO student_guardians
         (id, guardian_id, student_id, claimed_student_name, claimed_enrollment_year)
       VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), parentId, studentId, acc.childName, acc.childEnrollmentYear ?? null]
    );
  } else if (studentId) {
    await q('UPDATE student_guardians SET student_id = ? WHERE id = ?', [
      studentId,
      links[0].id,
    ]);
  }
  return studentId;
}

try {
  // 학부모가 자녀를 찾을 수 있도록 원생을 먼저 시드한다.
  const order = { student: 0, teacher: 1, parent: 2 };
  const sorted = [...accounts].sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9));

  for (const acc of sorted) {
    const { id, created } = await upsertUser(acc);
    let extra = '';
    if (acc.role === 'parent') {
      const studentId = await linkGuardian(id, acc);
      extra = studentId ? ' → 자녀 연결됨' : ' → 자녀 미연결(원생 없음/중복)';
    }
    console.log(
      `${created ? '생성' : '갱신'}: [${acc.role}] ${acc.name} <${acc.email}> pw=${acc.password}${extra}`
    );
  }

  console.log('\n완료. 회원 관리 화면 상단 "테스트 계정" 패널에서 비밀번호를 확인할 수 있습니다.');
} catch (err) {
  console.error('시드 실패:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}

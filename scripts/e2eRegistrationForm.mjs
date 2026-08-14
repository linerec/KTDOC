#!/usr/bin/env node
/**
 * 신청서 시스템 전 시나리오 시험 (실제 HTTP 제출)
 *
 * 돌아가는 dev/프리뷰 서버에 **진짜 제출을 던져** 응답과 저장 결과를 확인한다.
 * 단위 시험이 못 보는 것을 본다: 라우트 배선, 스팸 방어, 가입 결합, 파생 테이블,
 * 재제출 정리, 마감 처리.
 *
 * **만든 데이터는 끝에 전부 지운다.** 실패로 중단돼도 지우도록 finally 에 둔다.
 *   - D1: 시험용 신청서 1건 + 그 응답 전부(파생·이력은 CASCADE)
 *   - MySQL: 이메일이 @e2e-test.invalid 인 회원과 그 보호자 연결
 *
 * 사용: node scripts/e2eRegistrationForm.mjs [베이스URL]
 *      node scripts/e2eRegistrationForm.mjs --cleanup-only
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
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
    const [, key, raw] = m;
    if (!(key in process.env)) process.env[key] = raw.trim().replace(/^["']|["']$/g, '');
  }
}
loadEnv('.env.local');

const BASE = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:3000';
const CLEANUP_ONLY = process.argv.includes('--cleanup-only');
/** 브라우저로 직접 눌러 볼 수 있게 시험 신청서만 세우고 끝낸다(정리는 --cleanup-only 로). */
const SETUP_ONLY = process.argv.includes('--setup-only');

const SLUG = '__e2e-registration-test';
const TEST_EMAIL_DOMAIN = 'e2e-test.invalid';

// ── D1 ────────────────────────────────────────────────────────────
async function d1(sql, params = []) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${process.env.D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );
  const j = await r.json();
  if (!j.success) throw new Error('D1: ' + JSON.stringify(j.errors));
  return j.result[0];
}

// ── MySQL ─────────────────────────────────────────────────────────
let pool = null;
function mysqlPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 3,
    });
  }
  return pool;
}
async function sql(q, params = []) {
  const [rows] = await mysqlPool().query(q, params);
  return rows;
}

// ── 시험 골격 ─────────────────────────────────────────────────────
const results = [];
let formId = null;

function check(name, condition, detail = '') {
  results.push({ name, ok: !!condition, detail });
  console.log(`${condition ? '  ✔' : '  ✘'} ${name}${detail && !condition ? ` — ${detail}` : ''}`);
}

async function submit(answers, extra = {}) {
  const res = await fetch(`${BASE}/api/forms/${SLUG}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      answers,
      locale: 'ko',
      // 기본은 '충분히 머물렀다' — 스팸 시험만 이 값을 덮는다.
      renderedAt: Date.now() - 30_000,
      website: '',
      ...extra,
    }),
  });
  return { status: res.status, body: await res.json() };
}

/** 필수 항목이 모두 채워진 최소 정상 답변 */
function baseAnswers(over = {}) {
  return {
    q1_reg_type: 'new',
    q2_student_name: '시험학생',
    q3_grade: '3학년',
    q4_email: `plain@${TEST_EMAIL_DOMAIN}`,
    q4b_phone: '917-555-0100',
    q6_period: 'y1',
    q7_classes: ['kids_dance'],
    q8_perform: 'yes',
    q10_parade: true,
    q12_refund: true,
    q13_media: 'yes',
    q14_final: true,
    ...over,
  };
}

/**
 * 시험 신청서를 통째로 지운다.
 *
 * **순서가 중요하다.** form_schema_versions·form_responses 가 forms 를 FK 로 잡고 있고
 * ON DELETE 를 걸지 않았다(증빙이 연쇄 삭제되면 안 되므로). 먼저 지우지 않으면
 * DELETE FROM forms 가 FOREIGN KEY constraint failed 로 막힌다 — 실제로 막혔다.
 */
async function dropTestForm(id) {
  if (!id) return 0;
  const before = await d1('SELECT COUNT(*) AS n FROM form_responses WHERE form_id = ?', [id]);
  await d1('DELETE FROM form_responses WHERE form_id = ?', [id]);
  await d1('DELETE FROM form_schema_versions WHERE form_id = ?', [id]);
  await d1('DELETE FROM forms WHERE id = ?', [id]);
  return before.results[0].n;
}

// ── 정리 ──────────────────────────────────────────────────────────
async function cleanup() {
  console.log('\n── 정리 ─────────────────────────────────');
  try {
    const found = await d1('SELECT id FROM forms WHERE slug = ?', [SLUG]);
    const id = found.results[0]?.id ?? formId;
    if (id) {
      const n = await dropTestForm(id);
      console.log(`  D1: 신청서 1건 + 응답 ${n}건 삭제 (파생·이력은 CASCADE)`);
    } else {
      console.log('  D1: 지울 시험 신청서 없음');
    }
    const left = await d1('SELECT COUNT(*) AS n FROM forms WHERE slug = ?', [SLUG]);
    console.log(`  D1: 남은 시험 신청서 ${left.results[0].n}건`);
  } catch (e) {
    console.error('  D1 정리 실패:', e.message);
  }

  try {
    const users = await sql(`SELECT id FROM users WHERE email LIKE ?`, [`%@${TEST_EMAIL_DOMAIN}`]);
    if (users.length > 0) {
      const ids = users.map((u) => u.id);
      const ph = ids.map(() => '?').join(',');
      await sql(`DELETE FROM student_guardians WHERE guardian_id IN (${ph})`, ids);
      await sql(`DELETE FROM push_subscriptions WHERE user_id IN (${ph})`, ids).catch(() => {});
      await sql(`DELETE FROM notification_recipients WHERE user_id IN (${ph})`, ids).catch(() => {});
      await sql(`DELETE FROM users WHERE id IN (${ph})`, ids);
    }
    const rest = await sql(`SELECT COUNT(*) AS n FROM users WHERE email LIKE ?`, [
      `%@${TEST_EMAIL_DOMAIN}`,
    ]);
    console.log(`  MySQL: 시험 회원 ${users.length}건 삭제, 남은 ${rest[0].n}건`);
  } catch (e) {
    console.error('  MySQL 정리 실패:', e.message);
  }

  if (pool) await pool.end();
}

// ── 본문 ──────────────────────────────────────────────────────────
async function main() {
  if (CLEANUP_ONLY) return;

  console.log(`대상: ${BASE}\n`);

  // 시험용 신청서를 2026-2027 문안 그대로 복제해 접수 중으로 세운다.
  const src = await d1("SELECT schema_json, title_ko FROM forms WHERE slug = '2026-2027-regular'");
  if (!src.results[0]) throw new Error('원본 신청서(2026-2027-regular)가 없습니다. 먼저 시드하세요.');
  const schemaJson = src.results[0].schema_json;

  // 앞선 실행이 남긴 것이 있으면 같은 순서로 먼저 지운다.
  const stale = await d1('SELECT id FROM forms WHERE slug = ?', [SLUG]);
  if (stale.results[0]) await dropTestForm(stale.results[0].id);

  const created = await d1(
    `INSERT INTO forms (slug, season, kind, preset_key, title_ko, schema_json, schema_version, status, requires_login)
     VALUES (?, '9999-TEST', 'season', 'season-2026', '[시험] 신청서', ?, 1, 'open', 0)`,
    [SLUG, schemaJson]
  );
  formId = created.meta.last_row_id;
  await d1(
    `INSERT INTO form_schema_versions (form_id, version, schema_json, note) VALUES (?, 1, ?, 'e2e')`,
    [formId, schemaJson]
  );
  console.log(`시험 신청서 준비 — id ${formId}, /f/${SLUG} (접수 중)\n`);
  if (SETUP_ONLY) {
    console.log(`브라우저로 여세요: ${BASE}/f/${SLUG}`);
    console.log('끝나면: node scripts/e2eRegistrationForm.mjs --cleanup-only');
    return;
  }

  // ── 1. 정상 제출 ────────────────────────────────────────────────
  console.log('1. 비회원 정상 제출');
  {
    const { status, body } = await submit(baseAnswers());
    check('200 으로 접수된다', status === 200 && body.success, `status=${status} ${body.error ?? ''}`);
    check('접수번호를 돌려준다', body.data?.responseId > 0);
    check('가입을 요청하지 않았으므로 계정 결과가 없다', body.data?.account == null);

    const row = await d1('SELECT * FROM form_responses WHERE id = ?', [body.data.responseId]);
    const r = row.results[0];
    check('학생 이름이 코어 컬럼에 들어간다', r?.student_name === '시험학생', r?.student_name);
    check('전화가 코어 컬럼에 들어간다', r?.phone === '917-555-0100', r?.phone);
    check('이메일 정규화가 저장된다', r?.email_norm === `plain@${TEST_EMAIL_DOMAIN}`, r?.email_norm);
    check('건강 특이사항이 없으면 has_medical=0', r?.has_medical === 0);
    check('파생이 밀리지 않았다(derived_dirty=0)', r?.derived_dirty === 0);
    check('출처가 public 이다', r?.source === 'public');

    const sel = await d1('SELECT * FROM form_response_selections WHERE response_id = ?', [r.id]);
    check('선택 과목이 파생 테이블에 1건 생긴다', sel.results.length === 1, `${sel.results.length}건`);
    check(
      '과목 라벨이 시간까지 통째로 스냅샷된다',
      sel.results[0]?.option_label_ko?.startsWith('유년부 무용'),
      sel.results[0]?.option_label_ko
    );
    check('수업 연결(program_id)이 따라온다', sel.results[0]?.program_id === 13, String(sel.results[0]?.program_id));

    const con = await d1('SELECT * FROM form_response_consents WHERE response_id = ? ORDER BY consent_key', [r.id]);
    const keys = con.results.map((c) => c.consent_key);
    check(
      '동의 4종이 증빙으로 남는다(소품비는 해당 없어 제외)',
      JSON.stringify(keys) === JSON.stringify(['final', 'media_release', 'parade', 'refund_policy']),
      keys.join(',')
    );
    check('미디어 동의가 1로 기록된다', con.results.find((c) => c.consent_key === 'media_release')?.agreed === 1);

    const form = await d1('SELECT locked_at FROM forms WHERE id = ?', [formId]);
    check('첫 제출로 신청서 구조가 잠긴다', form.results[0]?.locked_at != null);
  }

  // ── 2. 검증 오류 ────────────────────────────────────────────────
  console.log('\n2. 검증 오류가 코드로 돌아온다 (영문 화면이 번역할 수 있게)');
  {
    const { status, body } = await submit(baseAnswers({ q2_student_name: '' }));
    check('필수 누락은 400', status === 400);
    check('오류 코드가 required 다', body.fieldErrors?.q2_student_name?.code === 'required',
      JSON.stringify(body.fieldErrors?.q2_student_name));
    check('본문 오류에도 코드가 붙는다', body.code === 'fieldErrors', body.code);
  }
  {
    const { body } = await submit(baseAnswers({ q4_email: 'not-an-email' }));
    check('이메일 형식 오류는 badEmail', body.fieldErrors?.q4_email?.code === 'badEmail');
  }
  {
    const { body } = await submit(baseAnswers({ q4b_phone: '12' }));
    check('전화 형식 오류는 badTel', body.fieldErrors?.q4b_phone?.code === 'badTel');
  }
  {
    const { body } = await submit(baseAnswers({ q7_classes: [] }));
    check('과목 미선택은 pickOne', body.fieldErrors?.q7_classes?.code === 'pickOne');
  }
  {
    const { body } = await submit(baseAnswers({ q7_classes: ['해킹시도'] }));
    check('없는 선택지는 badOptions', body.fieldErrors?.q7_classes?.code === 'badOptions');
  }
  {
    const { body } = await submit(baseAnswers({ q14_final: false }));
    check('최종 동의 누락은 consentRequired', body.fieldErrors?.q14_final?.code === 'consentRequired');
  }
  {
    const { body } = await submit(baseAnswers({ q1_reg_type: 'maybe' }));
    check('없는 단일선택 값은 badOption', body.fieldErrors?.q1_reg_type?.code === 'badOption');
  }

  // ── 3. 조건부 노출 ──────────────────────────────────────────────
  console.log('\n3. 조건부 노출 — 구글폼이 못 하던 것');
  {
    const { status, body } = await submit(
      baseAnswers({ q8_perform: 'no', q4_email: `noperf@${TEST_EMAIL_DOMAIN}` })
    );
    check('공연 미참가라도 사유는 선택 항목이라 통과한다', status === 200 && body.success, body.error);
  }
  {
    // 작품반을 골랐는데 소품비 동의를 안 하면 막혀야 한다
    const { status, body } = await submit(
      baseAnswers({ q7_classes: ['youth_repertoire'], q4_email: `yr1@${TEST_EMAIL_DOMAIN}` })
    );
    check('작품반을 고르면 칼 소품비가 필수가 된다', status === 400 && body.fieldErrors?.q11_prop,
      JSON.stringify(body.fieldErrors));
  }
  {
    const { status, body } = await submit(
      baseAnswers({ q7_classes: ['youth_repertoire'], q11_prop: 'agree', q4_email: `yr2@${TEST_EMAIL_DOMAIN}` })
    );
    check('동의하면 통과한다', status === 200 && body.success, body.error);
    if (body.data?.responseId) {
      const con = await d1(
        "SELECT agreed FROM form_response_consents WHERE response_id = ? AND consent_key = 'prop_fee'",
        [body.data.responseId]
      );
      check('칼 소품비 동의가 증빙으로 남는다', con.results[0]?.agreed === 1);
    }
  }
  {
    // 작품반을 안 골랐는데 소품비 답을 억지로 보내면 버려져야 한다
    const { status, body } = await submit(
      baseAnswers({ q11_prop: 'agree', q4_email: `drop@${TEST_EMAIL_DOMAIN}` })
    );
    check('숨겨진 문항의 답은 서버가 버린다', status === 200 && body.success, body.error);
    if (body.data?.responseId) {
      const con = await d1(
        "SELECT COUNT(*) AS n FROM form_response_consents WHERE response_id = ? AND consent_key = 'prop_fee'",
        [body.data.responseId]
      );
      check('보지 않은 항목에 동의한 것으로 기록되지 않는다', con.results[0].n === 0);
      const ans = await d1('SELECT answers_json FROM form_responses WHERE id = ?', [body.data.responseId]);
      check('답변 본문에도 남지 않는다', !JSON.parse(ans.results[0].answers_json).q11_prop);
    }
  }

  // ── 4. 민감정보 ─────────────────────────────────────────────────
  console.log('\n4. 건강 특이사항');
  {
    const { body } = await submit(
      baseAnswers({ q5_medical: '땅콩 알레르기', q4_email: `med@${TEST_EMAIL_DOMAIN}` })
    );
    const r = await d1('SELECT has_medical FROM form_responses WHERE id = ?', [body.data.responseId]);
    check('내용이 있으면 has_medical=1 이 선다', r.results[0]?.has_medical === 1);
  }

  // ── 5. 스팸 방어 ────────────────────────────────────────────────
  console.log('\n5. 스팸 방어');
  {
    const before = await d1('SELECT COUNT(*) AS n FROM form_responses WHERE form_id = ?', [formId]);
    const { status, body } = await submit(baseAnswers(), { website: 'http://spam.example' });
    check('허니팟은 조용히 성공으로 답한다', status === 200 && body.success);
    const after = await d1('SELECT COUNT(*) AS n FROM form_responses WHERE form_id = ?', [formId]);
    check('그러나 저장되지 않는다', after.results[0].n === before.results[0].n,
      `${before.results[0].n} → ${after.results[0].n}`);
  }
  {
    const { status, body } = await submit(baseAnswers(), { renderedAt: Date.now() });
    check('열자마자 제출하면 막힌다', status === 429 && body.code === 'tooFast', `${status} ${body.code}`);
  }
  {
    const { status, body } = await submit(baseAnswers({ q5_medical: 'x'.repeat(70_000) }));
    check('본문이 너무 길면 막힌다', status === 413 && body.code === 'tooLong', `${status} ${body.code}`);
  }

  // ── 6. 회원가입 ─────────────────────────────────────────────────
  console.log('\n6. 신청서 안에서의 회원가입');
  {
    const email = `parent@${TEST_EMAIL_DOMAIN}`;
    const { status, body } = await submit(
      baseAnswers({ q4_email: email, q2_student_name: '자녀학생', q4c_guardian: '보호자이름' }),
      { account: { role: 'parent', password: 'testpass1234', agreed: true } }
    );
    check('학부모 가입과 함께 접수된다', status === 200 && body.data?.account === 'created',
      `${status} ${body.data?.account}`);

    const users = await sql('SELECT * FROM users WHERE email = ?', [email]);
    check('회원이 만들어진다', users.length === 1);
    check('승인 대기 상태다', users[0]?.status === 'pending', users[0]?.status);
    check('역할이 parent 다', users[0]?.role === 'parent', users[0]?.role);
    check('보호자 이름이 계정 이름이 된다', users[0]?.name === '보호자이름', users[0]?.name);
    check('약관 동의 시각이 남는다', users[0]?.terms_agreed_at != null);

    const link = await sql('SELECT * FROM student_guardians WHERE guardian_id = ?', [users[0].id]);
    check('자녀 연결이 이름만으로 만들어진다(선행 가입 없이)', link.length === 1);
    check('자녀 계정이 없으니 student_id 는 비어 있다', link[0]?.student_id == null);
    check('자녀 이름이 신청서의 학생 이름이다', link[0]?.claimed_student_name === '자녀학생',
      link[0]?.claimed_student_name);

    const r = await d1('SELECT * FROM form_responses WHERE id = ?', [body.data.responseId]);
    check('응답에 제출자가 붙는다', r.results[0]?.submitted_by_user_id === users[0].id);
    check('학부모는 대상 학생으로 넣지 않는다', r.results[0]?.student_user_id == null,
      '학부모가 수업에 배정되면 안 된다');
    check('연결 경로가 signup 으로 기록된다', r.results[0]?.link_source === 'signup', r.results[0]?.link_source);
  }
  {
    const email = `student@${TEST_EMAIL_DOMAIN}`;
    const { body } = await submit(
      baseAnswers({ q4_email: email, q2_student_name: '본인학생' }),
      { account: { role: 'student', password: 'testpass1234', agreed: true } }
    );
    check('학생 본인 가입도 된다', body.data?.account === 'created', String(body.data?.account));
    const users = await sql('SELECT * FROM users WHERE email = ?', [email]);
    check('역할이 student 다', users[0]?.role === 'student', users[0]?.role);
    const r = await d1('SELECT * FROM form_responses WHERE id = ?', [body.data.responseId]);
    check('학생 본인은 대상 학생으로도 붙는다', r.results[0]?.student_user_id === users[0].id);
  }
  {
    // 이미 있는 이메일 — 자동으로 잇지 않는다
    const email = `parent@${TEST_EMAIL_DOMAIN}`;
    const { status, body } = await submit(
      baseAnswers({ q4_email: email, q2_student_name: '다른학생' }),
      { account: { role: 'parent', password: 'testpass1234', agreed: true } }
    );
    check('이미 가입된 이메일이면 계정을 새로 만들지 않는다', body.data?.account === 'email_taken',
      String(body.data?.account));
    check('그래도 신청서는 접수된다', status === 200 && body.data?.responseId > 0);
    const r = await d1('SELECT * FROM form_responses WHERE id = ?', [body.data.responseId]);
    check('미검증 이메일로 남의 계정에 자동으로 잇지 않는다', r.results[0]?.submitted_by_user_id == null);
    const dup = await sql('SELECT COUNT(*) AS n FROM users WHERE email = ?', [email]);
    check('중복 계정이 생기지 않는다', dup[0].n === 1, `${dup[0].n}건`);
  }
  {
    const email = `shortpw@${TEST_EMAIL_DOMAIN}`;
    const { body } = await submit(
      baseAnswers({ q4_email: email }),
      { account: { role: 'parent', password: 'short', agreed: true } }
    );
    check('짧은 비밀번호는 가입이 실패한다', body.data?.account === 'failed', String(body.data?.account));
    check('그래도 신청서는 접수된다', body.data?.responseId > 0);
    const users = await sql('SELECT COUNT(*) AS n FROM users WHERE email = ?', [email]);
    check('계정은 만들어지지 않는다', users[0].n === 0);
  }
  {
    const email = `noterms@${TEST_EMAIL_DOMAIN}`;
    const { body } = await submit(
      baseAnswers({ q4_email: email }),
      { account: { role: 'parent', password: 'testpass1234', agreed: false } }
    );
    check('약관 미동의는 가입이 실패한다', body.data?.account === 'failed', String(body.data?.account));
    const users = await sql('SELECT COUNT(*) AS n FROM users WHERE email = ?', [email]);
    check('계정은 만들어지지 않는다', users[0].n === 0);
  }

  // ── 7. 재제출 ───────────────────────────────────────────────────
  console.log('\n7. 재제출');
  {
    const email = `resubmit@${TEST_EMAIL_DOMAIN}`;
    const a = await submit(baseAnswers({ q4_email: email, q2_student_name: '재제출학생' }));
    const b = await submit(
      baseAnswers({ q4_email: email, q2_student_name: '재제출학생', q7_classes: ['drums_5standing'] })
    );
    const rows = await d1(
      'SELECT id, is_latest FROM form_responses WHERE form_id = ? AND email_norm = ? ORDER BY id',
      [formId, email]
    );
    check('두 건 모두 남는다(덮어쓰지 않는다)', rows.results.length === 2, `${rows.results.length}건`);
    check('옛 응답은 최신본에서 내려간다', rows.results[0]?.is_latest === 0);
    check('새 응답이 최신본이다', rows.results[1]?.is_latest === 1);
    check('접수번호는 서로 다르다', a.body.data.responseId !== b.body.data.responseId);
  }

  // ── 8. 명단·집계 ────────────────────────────────────────────────
  console.log('\n8. 명단 정렬 — 1년 등록 우선, 그다음 선착순');
  {
    await submit(baseAnswers({ q6_period: 'm3', q4_email: `m3@${TEST_EMAIL_DOMAIN}`, q2_student_name: 'ㄱ3개월' }));
    await submit(baseAnswers({ q6_period: 'y1', q4_email: `y1@${TEST_EMAIL_DOMAIN}`, q2_student_name: 'ㅎ1년' }));

    const roster = await d1(
      `SELECT r.student_name, json_extract(r.answers_json, '$.q6_period') AS period
         FROM form_response_selections s
         JOIN form_responses r ON r.id = s.response_id
        WHERE r.form_id = ? AND r.is_latest = 1 AND r.status != 'cancelled' AND s.option_key = 'kids_dance'
        ORDER BY CASE WHEN json_extract(r.answers_json, '$.q6_period') = 'y1' THEN 0 ELSE 1 END,
                 r.submitted_at, r.id`,
      [formId]
    );
    const firstNonY1 = roster.results.findIndex((x) => x.period !== 'y1');
    const lastY1 = roster.results.map((x) => x.period).lastIndexOf('y1');
    check('1년 등록이 3개월보다 앞에 온다', firstNonY1 === -1 || lastY1 < firstNonY1,
      roster.results.map((x) => `${x.student_name}(${x.period})`).join(' → '));
  }

  // ── 8.5 임시 게시 — 다 해볼 수 있지만 아무것도 남지 않는다 ─────
  console.log('\n8.5 임시 게시');
  {
    const before = await d1('SELECT COUNT(*) AS n FROM form_responses WHERE form_id = ?', [formId]);
    const lockedBefore = await d1('SELECT locked_at FROM forms WHERE id = ?', [formId]);
    await d1("UPDATE forms SET status = 'trial' WHERE id = ?", [formId]);

    // 검증은 진짜와 똑같이 겪어야 한다 — 그래야 확인이 된다.
    const bad = await submit(baseAnswers({ q2_student_name: '' }));
    check('임시 게시에서도 검증은 그대로 돈다', bad.status === 400 && bad.body.fieldErrors?.q2_student_name,
      `${bad.status}`);

    const ok = await submit(baseAnswers({ q4_email: `trial@${TEST_EMAIL_DOMAIN}` }));
    check('제출은 성공으로 답한다', ok.status === 200 && ok.body.success, ok.body.error);
    check('임시 게시임을 응답에 밝힌다', ok.body.data?.trial === true, JSON.stringify(ok.body.data));
    check('접수번호를 주지 않는다', ok.body.data?.responseId === 0, String(ok.body.data?.responseId));

    const after = await d1('SELECT COUNT(*) AS n FROM form_responses WHERE form_id = ?', [formId]);
    check('**아무것도 저장되지 않는다**', after.results[0].n === before.results[0].n,
      `${before.results[0].n} → ${after.results[0].n}`);

    // 가입도 일어나면 안 된다
    const signup = await submit(
      baseAnswers({ q4_email: `trialsignup@${TEST_EMAIL_DOMAIN}` }),
      { account: { role: 'parent', password: 'testpass1234', agreed: true } }
    );
    check('임시 게시에서는 회원가입도 하지 않는다', signup.body.data?.trial === true);
    const u = await sql('SELECT COUNT(*) AS n FROM users WHERE email = ?', [
      `trialsignup@${TEST_EMAIL_DOMAIN}`,
    ]);
    check('계정이 만들어지지 않는다', u[0].n === 0, `${u[0].n}건`);

    const lockedAfter = await d1('SELECT locked_at FROM forms WHERE id = ?', [formId]);
    check(
      '구조가 새로 잠기지 않는다 — 보고 나서 과목을 고칠 수 있어야 한다',
      lockedAfter.results[0]?.locked_at === lockedBefore.results[0]?.locked_at,
      `${lockedBefore.results[0]?.locked_at} → ${lockedAfter.results[0]?.locked_at}`
    );

    await d1("UPDATE forms SET status = 'open' WHERE id = ?", [formId]);
  }

  // ── 9. 마감·초안 ────────────────────────────────────────────────
  console.log('\n9. 마감된 신청서');
  {
    await d1("UPDATE forms SET status = 'closed' WHERE id = ?", [formId]);
    const { status, body } = await submit(baseAnswers());
    check('마감되면 제출이 막힌다', status === 404 && body.code === 'notOpen', `${status} ${body.code}`);
    await d1("UPDATE forms SET status = 'draft' WHERE id = ?", [formId]);
    const draft = await submit(baseAnswers());
    check('초안도 제출이 막힌다', draft.status === 404 && draft.body.code === 'notOpen',
      `${draft.status} ${draft.body.code}`);
    await d1("UPDATE forms SET status = 'open' WHERE id = ?", [formId]);
  }

  // ── 10. 없는 신청서 ─────────────────────────────────────────────
  console.log('\n10. 없는 신청서');
  {
    const res = await fetch(`${BASE}/api/forms/__does-not-exist/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: baseAnswers(), renderedAt: Date.now() - 30_000 }),
    });
    const body = await res.json();
    check('없는 주소는 404', res.status === 404 && body.code === 'notOpen', `${res.status} ${body.code}`);
  }

  // ── 11. 관리 API 는 로그인 없이 막힌다 ──────────────────────────
  console.log('\n11. 관리 API 권한');
  for (const path of [
    `/api/admin/forms`,
    `/api/admin/forms/${formId}`,
    `/api/admin/forms/${formId}/export.csv`,
    `/api/admin/forms/${formId}/roster`,
  ]) {
    const res = await fetch(`${BASE}${path}`);
    check(`${path} 는 비로그인에게 닫혀 있다`, res.status === 403 || res.status === 401 || res.status === 404,
      `status=${res.status}`);
  }
}

// ── 실행 ──────────────────────────────────────────────────────────
let failed = false;
try {
  await main();
} catch (e) {
  failed = true;
  console.error('\n시험 중 오류:', e.message);
} finally {
  // --setup-only 는 브라우저로 눌러 보려고 세우는 것이라 여기서 지우지 않는다.
  if (!SETUP_ONLY) await cleanup();
  else if (pool) await pool.end();
}

const pass = results.filter((r) => r.ok).length;
const fail = results.filter((r) => !r.ok);
console.log(`\n════════════════════════════════════════`);
console.log(`통과 ${pass} / 전체 ${results.length}`);
if (fail.length > 0) {
  console.log(`\n실패 ${fail.length}건:`);
  for (const f of fail) console.log(`  ✘ ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
}
process.exit(failed || fail.length > 0 ? 1 : 0);

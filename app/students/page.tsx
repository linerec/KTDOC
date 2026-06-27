/**
 * 연도별 수강생 아카이브 (공개)
 *
 * KTDOC에서 활동한 수강생을 입학년도별로 모아, 각자의 참여(체크인) 횟수와 함께 보여준다.
 * 학생 본인은 자신의 활동을, 관계 기관·관계자는 참여도를 확인할 수 있다.
 *
 * 개인정보: 정회원(active) 원생의 "이름"과 "입학년도", "참여 횟수"만 노출한다.
 *   이메일·전화 등 민감정보는 포함하지 않는다(getActiveStudents가 애초에 반환하지 않음).
 *   ※ 실명 공개 범위(이니셜/별명/opt-in 등)는 운영 배포(병합) 전에 확정한다.
 *
 * 데이터: 학생 = MySQL(users), 참여 횟수 = D1(event_checkins). 저장소가 달라 별도 조회 후 결합.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getActiveStudents, type PublicStudent } from '@/lib/members';
import { getCheckinCountsByUser } from '@/lib/d1';

export const metadata: Metadata = {
  title: '수강생 아카이브 | KTDOC',
  description: 'KTDOC 춤누리 한국전통무용단에서 활동한 수강생을 연도별로 모았습니다.',
};

/** 입학년도 내림차순. 미정(null)은 맨 뒤로. */
function groupByYear(students: PublicStudent[]): [number | null, PublicStudent[]][] {
  const map = new Map<number | null, PublicStudent[]>();
  for (const s of students) {
    const key = s.enrollment_year ?? null;
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }
  return Array.from(map.entries()).sort((a, b) => {
    if (a[0] === null) return 1;
    if (b[0] === null) return -1;
    return b[0] - a[0];
  });
}

export default async function StudentsPage() {
  const students = await getActiveStudents();
  const counts =
    students.length > 0
      ? await getCheckinCountsByUser(students.map((s) => s.id))
      : new Map<string, number>();

  const grouped = groupByYear(students);
  const totalParticipation = Array.from(counts.values()).reduce((a, b) => a + b, 0);

  return (
    <>
      <Header />
      <main className="students-page">
        <section className="students-hero">
          <div className="students-container">
            <p className="students-kicker">KTDOC ARCHIVE</p>
            <h1 className="students-title">수강생 아카이브</h1>
            <p className="students-lede">
              춤누리 한국전통무용단에서 활동한 수강생을 입학년도별로 모았습니다.
              각 수강생이 참여한 공연·이벤트 기록을 함께 보여드립니다.
            </p>
            <div className="students-stats">
              <span>
                <strong>{students.length}</strong>명의 수강생
              </span>
              <span>
                <strong>{grouped.filter(([y]) => y !== null).length}</strong>개 입학년도
              </span>
              <span>
                누적 참여 <strong>{totalParticipation}</strong>회
              </span>
            </div>
          </div>
        </section>

        <section className="students-body">
          <div className="students-container">
            {students.length === 0 ? (
              <p className="students-empty">아직 공개된 수강생 명단이 없습니다.</p>
            ) : (
              grouped.map(([year, list]) => (
                <section key={year ?? 'unknown'} className="students-year">
                  <div className="students-year-head">
                    <h2 className="students-year-title">{year ?? '입학년도 미정'}</h2>
                    <span className="students-year-count">{list.length}명</span>
                  </div>
                  <ul className="students-grid">
                    {list.map((s) => {
                      const n = counts.get(s.id) ?? 0;
                      return (
                        <li key={s.id} className="student-chip">
                          <span className="student-chip-name">{s.name || '이름 미입력'}</span>
                          {n > 0 && (
                            <span className="student-chip-count" title={`참여 ${n}회`}>
                              참여 {n}회
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}

            <p className="students-note">
              참여 횟수는 각 수강생이 공연·이벤트에 체크인한 기록을 바탕으로 집계됩니다.
              명단 등재나 표기에 대한 문의는{' '}
              <Link href="/about" className="students-note-link">
                춤누리
              </Link>
              로 연락해 주세요.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

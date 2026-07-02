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
import Image from 'next/image';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IntlObject from '@/components/common/IntlObject';
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
        {/* 표준 히어로 골격(label/title/subtitle/description) — gallery-hero가 캐노니컬 */}
        <section className="students-hero">
          <div className="students-container">
            <IntlObject keycode="students.hero.label" className="students-hero-label" />
            <IntlObject keycode="students.title" returnType="h1" className="students-hero-title" />
            <IntlObject keycode="students.hero.subtitle" returnType="p" className="students-hero-subtitle" />
            <IntlObject keycode="students.lede" returnType="p" className="students-hero-description" />
            <div className="students-stats">
              <span>
                <IntlObject keycode="students.stat.students" params={{ n: students.length }} />
              </span>
              <span>
                <IntlObject
                  keycode="students.stat.years"
                  params={{ n: grouped.filter(([y]) => y !== null).length }}
                />
              </span>
              <span>
                <IntlObject keycode="students.stat.participation" params={{ n: totalParticipation }} />
              </span>
            </div>
          </div>
        </section>

        <section className="students-body">
          <div className="students-container">
            {students.length === 0 ? (
              <IntlObject keycode="students.empty" returnType="p" className="students-empty" />
            ) : (
              grouped.map(([year, list]) => (
                <section key={year ?? 'unknown'} className="students-year">
                  <div className="students-year-head">
                    <h2 className="students-year-title">
                      {year ?? <IntlObject keycode="students.year.unknown" />}
                    </h2>
                    <span className="students-year-count">
                      <IntlObject keycode="students.year.count" params={{ n: list.length }} />
                    </span>
                  </div>
                  <ul className="students-grid">
                    {list.map((s) => {
                      const n = counts.get(s.id) ?? 0;
                      return (
                        <li key={s.id} className="student-card">
                          <span className="student-card-avatar" aria-hidden="true">
                            {s.profile_photo_url ? (
                              <Image
                                src={s.profile_photo_url}
                                alt=""
                                width={56}
                                height={56}
                                className="student-card-photo"
                              />
                            ) : (
                              <span className="student-card-initial">
                                {(s.name || '?').trim()[0]?.toUpperCase() ?? '?'}
                              </span>
                            )}
                          </span>
                          <span className="student-card-body">
                            <span className="student-card-name">
                              {s.name || <IntlObject keycode="students.name.unknown" />}
                            </span>
                            {n > 0 && (
                              <span className="student-card-count">
                                <IntlObject keycode="students.chip.participation" params={{ n }} />
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}

            {/* 문의 링크(<a href="/about">)는 어순이 언어마다 달라 메시지 HTML에 포함한다 */}
            <IntlObject keycode="students.note" returnType="p" className="students-note" />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

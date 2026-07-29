'use client';

/**
 * ScheduleCalendar — 관리 콘솔 캘린더(월 격자 + 선택 날짜 일정판)
 *
 * 구조 원칙(모바일·PC 모두 '캘린더'로 읽히게):
 *  1. 격자는 항상 7열 균등이다. 칸 안의 내용이 열 너비를 밀지 않도록
 *     minmax(0,1fr) + min-width:0을 쓰고, 제목은 말줄임으로 자른다.
 *  2. 폭에 따라 칸 표현이 바뀐다(컨테이너 쿼리 — 사이드바 유무와 무관하게
 *     '실제 캘린더 폭'으로 판정). 좁으면 종류별 색점, 넓으면 제목 칩.
 *  3. 칸 자체가 버튼이다. 칸을 누르면 아래 일정판에 그 날의 전체 목록이
 *     펼쳐지고, 이동 링크는 거기 있다(칸 안에 링크를 중첩하지 않는다).
 *     → 일정이 몇 개든 칸 모양이 무너지지 않고, 터치 표적도 칸 전체로 커진다.
 *  4. 앞뒤 달 날짜도 흐리게 채워 6주 격자의 빈 구멍을 없앤다.
 *
 * 월 이동은 서버 라우팅(?month=)이라 링크로 두고, 날짜 선택만 클라이언트 상태다.
 */

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { useT, type TFunction } from '@/lib/i18n/useT';

export type CalendarItemType = 'performance' | 'school' | 'class';

export interface CalendarItem {
  key: string;
  date: string; // YYYY-MM-DD
  type: CalendarItemType;
  title: string;
  time: string | null; // "19:00" 또는 "10:00~12:00", null=종일
  href: string;
  isMine?: boolean; // 체크인한 공연
  isDraft?: boolean; // 비공개(운영진 작성 중)
  note?: string | null; // 장소·분류 등 보조 정보
}

interface ScheduleCalendarProps {
  year: number;
  month: number; // 1~12
  today: string; // YYYY-MM-DD
  items: CalendarItem[];
  prevHref: string;
  nextHref: string;
  todayHref: string;
  showMine: boolean; // 학생(체크인 가능) — '참여' 범례
  showMember: boolean; // 학생·학부모 — '내 수업'·'비공개' 범례
}

/** 한 칸에 노출하는 최대 항목 수. 넘치면 "+N"으로 접는다. */
const MAX_IN_CELL = 3;
/** 요일 머리글용 기준 주(2023-01-01=일요일). 언어별 요일명은 Intl이 만든다. */
const WEEK_BASE = Date.UTC(2023, 0, 1);

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 'YYYY-MM-DD' → UTC Date. 날짜 문자열 연산에 타임존이 끼어들지 않게 한다. */
function toUTC(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function typeLabel(type: CalendarItemType, t: TFunction): string {
  if (type === 'class') return t('admin.schedule.typeClass', '내 수업');
  if (type === 'school') return t('admin.schedule.typeSchool', '학내 행사');
  return t('admin.schedule.typePerformance', '공연');
}

/** 종일(시간 없음)이 먼저, 그 다음 시작 시간 오름차순. */
function byTime(a: CalendarItem, b: CalendarItem): number {
  if (!a.time && !b.time) return a.title.localeCompare(b.title);
  if (!a.time) return -1;
  if (!b.time) return 1;
  return a.time.localeCompare(b.time);
}

export default function ScheduleCalendar({
  year,
  month,
  today,
  items,
  prevHref,
  nextHref,
  todayHref,
  showMine,
  showMember,
}: ScheduleCalendarProps) {
  const t = useT();
  const { locale } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /** 날짜 선택 토글. 좁은 화면에서는 일정판이 접혀 있는 아래쪽이라 필요한 만큼만 스크롤한다. */
  const pickDay = (date: string) => {
    const next = date === selected ? null : date;
    setSelected(next);
    if (next) {
      requestAnimationFrame(() =>
        panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      );
    }
  };

  // 날짜 표기는 언어별 관례를 Intl에 맡긴다(ko: '7월 16일 (목)', en: 'Thu, July 16').
  const intlLocale = locale === 'en' ? 'en-US' : 'ko-KR';
  const fmt = useMemo(
    () => ({
      month: new Intl.DateTimeFormat(intlLocale, { year: 'numeric', month: 'long', timeZone: 'UTC' }),
      monthShort: new Intl.DateTimeFormat(intlLocale, { month: 'long', timeZone: 'UTC' }),
      day: new Intl.DateTimeFormat(intlLocale, {
        month: 'long',
        day: 'numeric',
        weekday: 'short',
        timeZone: 'UTC',
      }),
      weekday: new Intl.DateTimeFormat(intlLocale, { weekday: 'short', timeZone: 'UTC' }),
    }),
    [intlLocale]
  );

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const list = map.get(it.date) ?? [];
      list.push(it);
      map.set(it.date, list);
    }
    for (const list of map.values()) list.sort(byTime);
    return map;
  }, [items]);

  // 6주 격자 — 앞뒤 달 날짜까지 채워 빈 구멍을 없앤다.
  const weeks = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const start = new Date(Date.UTC(year, month - 1, 1 - firstWeekday));

    const rows: { date: string; day: number; inMonth: boolean }[][] = [];
    const total = firstWeekday + daysInMonth;
    const weekCount = Math.ceil(total / 7);
    for (let w = 0; w < weekCount; w++) {
      const row = [];
      for (let d = 0; d < 7; d++) {
        const cur = new Date(start);
        cur.setUTCDate(start.getUTCDate() + w * 7 + d);
        const date = `${cur.getUTCFullYear()}-${pad(cur.getUTCMonth() + 1)}-${pad(cur.getUTCDate())}`;
        row.push({
          date,
          day: cur.getUTCDate(),
          inMonth: cur.getUTCMonth() + 1 === month && cur.getUTCFullYear() === year,
        });
      }
      rows.push(row);
    }
    return rows;
  }, [year, month]);

  const monthItems = useMemo(() => [...items].sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b)), [items]);

  const counts = useMemo(() => {
    let performance = 0;
    let school = 0;
    let klass = 0;
    for (const it of items) {
      if (it.type === 'class') klass += 1;
      else if (it.type === 'school') school += 1;
      else performance += 1;
    }
    return { performance, school, klass };
  }, [items]);

  const dayLabel = (date: string) => fmt.day.format(toUTC(date));

  // 일정판: 날짜를 고르면 그 날, 아니면 이 달 전체를 날짜별로 묶어 보여준다.
  const panelGroups: { date: string; list: CalendarItem[] }[] = selected
    ? [{ date: selected, list: byDate.get(selected) ?? [] }]
    : (() => {
        const groups: { date: string; list: CalendarItem[] }[] = [];
        for (const it of monthItems) {
          const last = groups[groups.length - 1];
          if (last && last.date === it.date) last.list.push(it);
          else groups.push({ date: it.date, list: [it] });
        }
        return groups;
      })();

  const panelCount = panelGroups.reduce((a, g) => a + g.list.length, 0);

  return (
    <div className="cal-app">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <Link href={prevHref} className="cal-nav-btn" aria-label={t('admin.schedule.prevMonth', '이전 달')}>
            <span aria-hidden="true">‹</span>
          </Link>
          <h2 className="cal-title">{fmt.month.format(new Date(Date.UTC(year, month - 1, 1)))}</h2>
          <Link href={nextHref} className="cal-nav-btn" aria-label={t('admin.schedule.nextMonth', '다음 달')}>
            <span aria-hidden="true">›</span>
          </Link>
        </div>
        <Link href={todayHref} className="cal-today-btn">
          {t('admin.schedule.today', '오늘')}
        </Link>
        <p className="cal-summary">
          <span>
            {typeLabel('performance', t)} <b>{counts.performance}</b>
          </span>
          {counts.school > 0 && (
            <span>
              {typeLabel('school', t)} <b>{counts.school}</b>
            </span>
          )}
          {showMember && (
            <span>
              {typeLabel('class', t)} <b>{counts.klass}</b>
            </span>
          )}
        </p>
      </div>

      <div className="cal-grid">
        <div className="cal-row">
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className={`cal-weekday${i === 0 ? ' is-sun' : ''}${i === 6 ? ' is-sat' : ''}`}
            >
              {fmt.weekday.format(new Date(WEEK_BASE + i * 86400000))}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div className="cal-row" key={`w${wi}`}>
            {week.map(({ date, day, inMonth }, di) => {
              const list = inMonth ? byDate.get(date) ?? [] : [];
              const isToday = date === today;
              const isSelected = date === selected;
              const visible = list.slice(0, MAX_IN_CELL);
              const rest = list.length - visible.length;
              const cls = [
                'cal-cell',
                inMonth ? '' : 'is-out',
                isToday ? 'is-today' : '',
                isSelected ? 'is-selected' : '',
                list.length > 0 ? 'has-items' : '',
                di === 0 ? 'is-sun' : '',
                di === 6 ? 'is-sat' : '',
              ]
                .filter(Boolean)
                .join(' ');

              const body = (
                <>
                  <span className="cal-daynum">{day}</span>
                  {list.length > 0 && (
                    <span className="cal-chips">
                      {visible.map((it) => (
                        <span
                          key={it.key}
                          className={`cal-chip is-${it.type}${it.isMine ? ' is-mine' : ''}${
                            it.isDraft ? ' is-draft' : ''
                          }`}
                        >
                          {it.isMine && (
                            <span className="cal-chip-mark" aria-hidden="true">
                              ✓
                            </span>
                          )}
                          {it.time && <span className="cal-chip-time">{it.time.slice(0, 5)}</span>}
                          <span className="cal-chip-title">{it.title}</span>
                        </span>
                      ))}
                      {rest > 0 && <span className="cal-more">+{rest}</span>}
                    </span>
                  )}
                </>
              );

              if (!inMonth || list.length === 0) {
                return (
                  <div className={cls} key={date}>
                    {body}
                  </div>
                );
              }
              return (
                <button
                  type="button"
                  className={cls}
                  key={date}
                  aria-pressed={isSelected}
                  aria-label={`${dayLabel(date)} · ${t('admin.schedule.countAria', '일정 {n}건', {
                    n: list.length,
                  })}`}
                  onClick={() => pickDay(date)}
                >
                  {body}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="cal-panel" ref={panelRef}>
        <div className="cal-panel-head">
          <h3 className="cal-panel-title">
            {selected
              ? dayLabel(selected)
              : t('admin.schedule.monthAll', '{m} 전체 일정', {
                  m: fmt.monthShort.format(new Date(Date.UTC(year, month - 1, 1))),
                })}
          </h3>
          <span className="cal-panel-count">{t('admin.schedule.count', '{n}건', { n: panelCount })}</span>
          {selected && (
            <button type="button" className="cal-panel-back" onClick={() => setSelected(null)}>
              {t('admin.schedule.backToMonth', '이 달 전체 보기')}
            </button>
          )}
        </div>

        {panelCount === 0 ? (
          <p className="cal-panel-empty">
            {selected
              ? t('admin.schedule.emptyDay', '이 날은 등록된 일정이 없습니다.')
              : t('admin.schedule.emptyMonth', '이번 달에는 등록된 일정이 없습니다.')}
          </p>
        ) : (
          <div className="cal-agenda">
            {panelGroups.map((g) => (
              <section className="cal-agenda-group" key={g.date}>
                {!selected && (
                  <h4 className="cal-agenda-date">
                    {dayLabel(g.date)}
                    {g.date === today && (
                      <span className="cal-agenda-todaytag">{t('admin.schedule.today', '오늘')}</span>
                    )}
                  </h4>
                )}
                <ul className="cal-agenda-list">
                  {g.list.map((it) => (
                    <li key={it.key}>
                      <Link href={it.href} className={`cal-agenda-link is-${it.type}`}>
                        <span className="cal-agenda-time">
                          {it.time ?? t('admin.schedule.allDay', '종일')}
                        </span>
                        <span className="cal-agenda-body">
                          <span className="cal-agenda-title">{it.title}</span>
                          {it.note && <span className="cal-agenda-note">{it.note}</span>}
                        </span>
                        <span className="cal-agenda-tags">
                          {it.isMine && (
                            <span className="cal-tag is-mine">{t('admin.schedule.tagMine', '참여')}</span>
                          )}
                          {it.isDraft && (
                            <span className="cal-tag is-draft">{t('admin.schedule.tagDraft', '비공개')}</span>
                          )}
                          <span className="cal-tag">{typeLabel(it.type, t)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="cal-legend">
        <span>
          <i className="cal-swatch is-performance" /> {typeLabel('performance', t)}
        </span>
        <span>
          <i className="cal-swatch is-school" /> {typeLabel('school', t)}
        </span>
        {showMember && (
          <span>
            <i className="cal-swatch is-class" /> {typeLabel('class', t)}
          </span>
        )}
        {showMine && (
          <span>
            <i className="cal-swatch is-mine" /> {t('admin.schedule.legendMine', '내가 참여')}
          </span>
        )}
        {showMember && (
          <span>
            <i className="cal-swatch is-draft" /> {t('admin.schedule.tagDraft', '비공개')}
          </span>
        )}
      </div>
    </div>
  );
}

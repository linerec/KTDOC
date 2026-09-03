'use client';

/**
 * ProgramForm
 * 수업·프로그램·캠프 생성/편집 폼 (gallery EventForm 패턴).
 * 종류(program_type)에 따라 일정 입력이 달라집니다: 수업/프로그램은 요일·시간 텍스트, 캠프는 기간(시작~종료).
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProgramDetail, CreateProgramInput, UpdateProgramInput, ProgramType } from '@/types/programs';
import { PROGRAM_TYPES } from '@/types/programs';
import { useT, type TFunction } from '@/lib/i18n/useT';
import { programTypeLabel } from '@/lib/i18n/programLabels';
import { classDatesInMonth } from '@/lib/programSchedule';
import type { SupplyItem, SupplySetWithItems } from '@/types/supplies';
import ProgramImageUploader from './ProgramImageUploader';
import ProgramImageSortable from './ProgramImageSortable';
import SupplyPicker, { type PickerRow } from '@/components/admin/supplies/SupplyPicker';
import SetPicker, { type SetPickerRow } from '@/components/admin/supplies/SetPicker';

export interface FormChoice {
  id: number;
  title_ko: string;
  status: string;
}

interface ProgramFormProps {
  program?: ProgramDetail | null;
  /** 이 수업에 붙일 수 있는 신청서 목록(신청서 관리에서 만든 것들) */
  forms?: FormChoice[];
  isNew?: boolean;
  activeSupplies?: SupplyItem[];
  initialSupplies?: PickerRow[];
  activeSupplySets?: SupplySetWithItems[];
  initialSupplySets?: SetPickerRow[];
}

// 요일 칩(0=일 ~ 6=토). weekdays 컬럼은 선택된 값들의 쉼표 문자열로 저장된다.
// 라벨은 한 글자(일·월·…)라 영어에서는 Sun·Mon으로 갈아끼운다 — 키코드로 뽑는다.
const WEEKDAY_CHIPS: { v: string; ko: string }[] = [
  { v: '0', ko: '일' },
  { v: '1', ko: '월' },
  { v: '2', ko: '화' },
  { v: '3', ko: '수' },
  { v: '4', ko: '목' },
  { v: '5', ko: '금' },
  { v: '6', ko: '토' },
];

// 반복 주기 칩(1~5주). week_ordinals 컬럼은 선택된 값들의 쉼표 문자열로 저장된다.
// 아무것도 고르지 않으면 '매주'다 — 기존 수업의 동작이 그대로 유지되는 쪽이 기본값이다.
const ORDINAL_CHIPS: { v: string; ko: string }[] = [
  { v: '1', ko: '첫째' },
  { v: '2', ko: '둘째' },
  { v: '3', ko: '셋째' },
  { v: '4', ko: '넷째' },
  { v: '5', ko: '다섯째' },
];

/**
 * 'YYYY-MM-DD' → '9월 12일 (토)' / 'Sep 12 (Sat)' — 미리보기·예외 칩의 짧은 표기.
 * 요일 이름은 이미 있는 admin.weekday.short.* 를 그대로 쓴다(두 벌로 갈라지지 않게).
 */
function shortDate(t: TFunction, date: string): string {
  const [, m, d] = date.split('-');
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return t('admin.programs.dateShort', '{m}월 {d}일 ({w})', {
    m: Number(m),
    d: Number(d),
    w: t(`admin.weekday.short.${dow}`, ['일', '월', '화', '수', '목', '금', '토'][dow]),
  });
}

export default function ProgramForm({
  program,
  forms = [],
  isNew = false,
  activeSupplies = [],
  initialSupplies = [],
  activeSupplySets = [],
  initialSupplySets = [],
}: ProgramFormProps) {
  const router = useRouter();
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplies, setSupplies] = useState<PickerRow[]>(initialSupplies);
  const [supplySets, setSupplySets] = useState<SetPickerRow[]>(initialSupplySets);

  const [formData, setFormData] = useState({
    program_type: (program?.program_type || 'program') as ProgramType,
    title_ko: program?.title_ko || '',
    title_en: program?.title_en || '',
    summary_ko: program?.summary_ko || '',
    summary_en: program?.summary_en || '',
    description_ko: program?.description_ko || '',
    description_en: program?.description_en || '',
    age_range: program?.age_range || '',
    schedule_ko: program?.schedule_ko || '',
    schedule_en: program?.schedule_en || '',
    start_date: program?.start_date?.split('T')[0] || '',
    end_date: program?.end_date?.split('T')[0] || '',
    price_ko: program?.price_ko || '',
    price_en: program?.price_en || '',
    location_ko: program?.location_ko || '',
    location_en: program?.location_en || '',
    weekdays: program?.weekdays || '',
    week_ordinals: program?.week_ordinals || '',
    skip_dates: program?.skip_dates || '',
    extra_dates: program?.extra_dates || '',
    class_start_time: program?.class_start_time || '',
    class_end_time: program?.class_end_time || '',
    term_start_date: program?.term_start_date?.split('T')[0] || '',
    term_end_date: program?.term_end_date?.split('T')[0] || '',
    is_published: program?.is_published === 1,
    is_featured: program?.is_featured === 1,
    // 빈 문자열 = 연결 없음. 셀렉트의 값이므로 문자열로 다룬다.
    active_form_id: program?.active_form_id != null ? String(program.active_form_id) : '',
  });

  const [images, setImages] = useState(program?.images || []);

  const isCamp = formData.program_type === 'camp';

  const selectedWeekdays = new Set(formData.weekdays.split(',').filter(Boolean));
  const toggleWeekday = (d: string) => {
    setFormData((prev) => {
      const set = new Set(prev.weekdays.split(',').filter(Boolean));
      if (set.has(d)) set.delete(d);
      else set.add(d);
      const ordered = ['0', '1', '2', '3', '4', '5', '6'].filter((x) => set.has(x));
      return { ...prev, weekdays: ordered.join(',') };
    });
  };

  const selectedOrdinals = new Set(formData.week_ordinals.split(',').filter(Boolean));
  const toggleOrdinal = (o: string) => {
    setFormData((prev) => {
      const set = new Set(prev.week_ordinals.split(',').filter(Boolean));
      if (set.has(o)) set.delete(o);
      else set.add(o);
      const ordered = ['1', '2', '3', '4', '5'].filter((x) => set.has(x));
      return { ...prev, week_ordinals: ordered.join(',') };
    });
  };

  // 예외 날짜(휴강·보강)는 쉼표구분 문자열 하나에 정렬해 담는다.
  const [exceptionDraft, setExceptionDraft] = useState('');
  const skipDates = formData.skip_dates.split(',').filter(Boolean);
  const extraDates = formData.extra_dates.split(',').filter(Boolean);
  const addException = (field: 'skip_dates' | 'extra_dates') => {
    const date = exceptionDraft;
    if (!date) return;
    setFormData((prev) => {
      // 같은 날짜가 양쪽에 남으면 판정이 헷갈린다 — 반대쪽에서 빼고 넣는다.
      const other = field === 'skip_dates' ? 'extra_dates' : 'skip_dates';
      const mine = new Set(prev[field].split(',').filter(Boolean));
      mine.add(date);
      const theirs = prev[other].split(',').filter(Boolean).filter((d) => d !== date);
      return {
        ...prev,
        [field]: [...mine].sort().join(','),
        [other]: theirs.join(','),
      };
    });
    setExceptionDraft('');
  };
  const removeException = (field: 'skip_dates' | 'extra_dates', date: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field]
        .split(',')
        .filter(Boolean)
        .filter((d) => d !== date)
        .join(','),
    }));
  };

  // 미리보기 — 캘린더와 **같은 함수**로 이번 달·다음 달 수업일을 뽑는다.
  // 규칙을 글로 설명하는 대신 날짜를 보여 주는 편이 확인이 빠르고, 두 화면이
  // 어긋날 수 없다는 보장도 된다.
  const schedulePreview = useMemo(() => {
    if (isCamp || (!formData.weekdays && !formData.extra_dates)) return null;
    const rule = {
      weekdays: formData.weekdays,
      week_ordinals: formData.week_ordinals,
      skip_dates: formData.skip_dates,
      extra_dates: formData.extra_dates,
      term_start_date: formData.term_start_date,
      term_end_date: formData.term_end_date,
    };
    const now = new Date();
    const months: { label: string; dates: string[] }[] = [];
    for (let i = 0; i < 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      months.push({ label: `${y}년 ${m}월`, dates: classDatesInMonth(rule, y, m) });
    }
    return months;
  }, [
    isCamp,
    formData.weekdays,
    formData.week_ordinals,
    formData.skip_dates,
    formData.extra_dates,
    formData.term_start_date,
    formData.term_end_date,
  ]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isCamp && formData.start_date && formData.end_date && formData.end_date < formData.start_date) {
      setError(
        t('admin.programs.campDateError', '캠프 종료일은 시작일보다 빠를 수 없습니다.')
      );
      return;
    }

    setSaving(true);
    try {
      const url = isNew ? '/api/admin/programs' : `/api/admin/programs/${program?.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const body: CreateProgramInput | UpdateProgramInput = {
        program_type: formData.program_type,
        title_ko: formData.title_ko,
        title_en: formData.title_en || undefined,
        summary_ko: formData.summary_ko || undefined,
        summary_en: formData.summary_en || undefined,
        description_ko: formData.description_ko || undefined,
        description_en: formData.description_en || undefined,
        age_range: formData.age_range || undefined,
        schedule_ko: isCamp ? undefined : formData.schedule_ko || undefined,
        schedule_en: isCamp ? undefined : formData.schedule_en || undefined,
        start_date: isCamp ? formData.start_date || undefined : undefined,
        end_date: isCamp ? formData.end_date || undefined : undefined,
        weekdays: isCamp ? undefined : formData.weekdays || undefined,
        // 빈 문자열을 보내야 '비움'이 저장된다(undefined는 '건드리지 않음').
        week_ordinals: isCamp ? undefined : formData.week_ordinals,
        skip_dates: isCamp ? undefined : formData.skip_dates,
        extra_dates: isCamp ? undefined : formData.extra_dates,
        class_start_time: isCamp ? undefined : formData.class_start_time || undefined,
        class_end_time: isCamp ? undefined : formData.class_end_time || undefined,
        term_start_date: isCamp ? undefined : formData.term_start_date || undefined,
        term_end_date: isCamp ? undefined : formData.term_end_date || undefined,
        price_ko: formData.price_ko || undefined,
        price_en: formData.price_en || undefined,
        location_ko: formData.location_ko || undefined,
        location_en: formData.location_en || undefined,
        is_published: formData.is_published,
        is_featured: formData.is_featured,
        // null 을 보내야 '연결 끊기'가 된다 — undefined 는 '건드리지 않음'이다.
        active_form_id: formData.active_form_id ? Number(formData.active_form_id) : null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, supplies, supply_sets: supplySets }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || t('admin.common.saveFailed', '저장에 실패했습니다.'));
      }

      if (isNew && data.data?.id) {
        router.push(`/admin/programs/${data.data.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.common.saveFailed', '저장에 실패했습니다.')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form">
      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      <div className="admin-form-grid">
        {/* 기본 정보 */}
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">{t('admin.programs.secBasic', '기본 정보')}</h3>
          <p className="admin-form-help">
            {t(
              'admin.programs.secBasicHelp',
              '공개 페이지의 카드와 상세 페이지에 표시되는 정보입니다. 종류를 먼저 선택하세요.'
            )}
          </p>

          <div className="admin-form-group">
            <label htmlFor="program_type" className="admin-form-label">
              {t('admin.programs.fieldType', '종류')} <span className="required">*</span>
            </label>
            <select
              id="program_type"
              name="program_type"
              value={formData.program_type}
              onChange={handleChange}
              className="admin-form-select"
            >
              {PROGRAM_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {programTypeLabel(t, pt)}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-form-group">
            <label htmlFor="title_ko" className="admin-form-label">
              {t('admin.common.fieldTitleKo', '제목 (한글)')} <span className="required">*</span>
            </label>
            <input
              type="text"
              id="title_ko"
              name="title_ko"
              value={formData.title_ko}
              onChange={handleChange}
              required
              className="admin-form-input"
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="title_en" className="admin-form-label">
              {t('admin.common.fieldTitleEn', '제목 (영문)')}
            </label>
            <input
              type="text"
              id="title_en"
              name="title_en"
              value={formData.title_en}
              onChange={handleChange}
              className="admin-form-input"
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="summary_ko" className="admin-form-label">
              {t('admin.programs.fieldSummaryKo', '한 줄 소개 (한글)')}
            </label>
            <input
              type="text"
              id="summary_ko"
              name="summary_ko"
              value={formData.summary_ko}
              onChange={handleChange}
              className="admin-form-input"
              placeholder={t('admin.programs.summaryPlaceholder', '카드에 표시되는 짧은 소개')}
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="summary_en" className="admin-form-label">
              {t('admin.programs.fieldSummaryEn', '한 줄 소개 (영문)')}
            </label>
            <input
              type="text"
              id="summary_en"
              name="summary_en"
              value={formData.summary_en}
              onChange={handleChange}
              className="admin-form-input"
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="description_ko" className="admin-form-label">
              {t('admin.common.fieldDescKo', '상세 설명 (한글)')}
            </label>
            <textarea
              id="description_ko"
              name="description_ko"
              value={formData.description_ko}
              onChange={handleChange}
              rows={5}
              className="admin-form-textarea"
              placeholder={t(
                'admin.programs.descPlaceholder',
                '수업 내용, 강사, 준비물, 포함 사항 등을 자유롭게 작성하세요.'
              )}
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="description_en" className="admin-form-label">
              {t('admin.common.fieldDescEn', '상세 설명 (영문)')}
            </label>
            <textarea
              id="description_en"
              name="description_en"
              value={formData.description_en}
              onChange={handleChange}
              rows={5}
              className="admin-form-textarea"
            />
          </div>
        </div>

        {/* 일정 */}
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">
            {t('admin.programs.secSchedule', '일정 · 장소')}
          </h3>
          {isCamp ? (
            <>
              <p className="admin-form-help">
                {t(
                  'admin.programs.campHelp',
                  '캠프 기간을 선택하세요. 종료일은 시작일 이후여야 합니다.'
                )}
              </p>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="start_date" className="admin-form-label">
                    {t('admin.programs.fieldCampStart', '캠프 시작일')}
                  </label>
                  <input
                    type="date"
                    id="start_date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleChange}
                    className="admin-form-input"
                  />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="end_date" className="admin-form-label">
                    {t('admin.programs.fieldCampEnd', '캠프 종료일')}
                  </label>
                  <input
                    type="date"
                    id="end_date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleChange}
                    className="admin-form-input"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="admin-form-help">
                {t(
                  'admin.programs.classScheduleHelp',
                  '요일·주차·시간·학기 기간을 입력하면 원생·학부모 캘린더에 자동으로 표시됩니다. 아래 ‘수업 일정 안내’는 공개 페이지에 보이는 보조 설명입니다.'
                )}
              </p>
              <div className="admin-form-group">
                <label className="admin-form-label">
                  {t('admin.programs.fieldWeekdays', '수업 요일')}
                </label>
                <div className="admin-weekday-row">
                  {WEEKDAY_CHIPS.map((w) => (
                    <button
                      type="button"
                      key={w.v}
                      className={`admin-weekday-chip${selectedWeekdays.has(w.v) ? ' is-on' : ''}`}
                      onClick={() => toggleWeekday(w.v)}
                      aria-pressed={selectedWeekdays.has(w.v)}
                    >
                      {t(`admin.weekday.short.${w.v}`, w.ko)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">
                  {t('admin.programs.fieldWeekOrdinals', '반복 주기')}
                </label>
                <div className="admin-weekday-row">
                  <button
                    type="button"
                    className={`admin-weekday-chip admin-weekday-chip--wide${
                      selectedOrdinals.size === 0 ? ' is-on' : ''
                    }`}
                    onClick={() => setFormData((prev) => ({ ...prev, week_ordinals: '' }))}
                    aria-pressed={selectedOrdinals.size === 0}
                  >
                    {t('admin.programs.ordinalEveryWeek', '매주')}
                  </button>
                  {ORDINAL_CHIPS.map((o) => (
                    <button
                      type="button"
                      key={o.v}
                      className={`admin-weekday-chip admin-weekday-chip--wide${
                        selectedOrdinals.has(o.v) ? ' is-on' : ''
                      }`}
                      onClick={() => toggleOrdinal(o.v)}
                      aria-pressed={selectedOrdinals.has(o.v)}
                    >
                      {t(`admin.ordinal.${o.v}`, o.ko)}
                    </button>
                  ))}
                </div>
                <p className="admin-form-help">
                  {t(
                    'admin.programs.weekOrdinalHelp',
                    '격주·월 2회 수업은 여기서 주차를 고릅니다. 예: 둘째·넷째를 고르면 매월 둘째 주와 넷째 주에만 표시됩니다. ‘매주’면 종전대로 매주 표시합니다.'
                  )}
                </p>
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="class_start_time" className="admin-form-label">
                    {t('admin.programs.fieldStartTime', '시작 시간')}
                  </label>
                  <input
                    type="time"
                    id="class_start_time"
                    name="class_start_time"
                    value={formData.class_start_time}
                    onChange={handleChange}
                    className="admin-form-input"
                  />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="class_end_time" className="admin-form-label">
                    {t('admin.programs.fieldEndTime', '종료 시간')}
                  </label>
                  <input
                    type="time"
                    id="class_end_time"
                    name="class_end_time"
                    value={formData.class_end_time}
                    onChange={handleChange}
                    className="admin-form-input"
                  />
                </div>
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label htmlFor="term_start_date" className="admin-form-label">
                    {t('admin.programs.fieldTermStart', '학기 시작일 (선택)')}
                  </label>
                  <input
                    type="date"
                    id="term_start_date"
                    name="term_start_date"
                    value={formData.term_start_date}
                    onChange={handleChange}
                    className="admin-form-input"
                  />
                </div>
                <div className="admin-form-group">
                  <label htmlFor="term_end_date" className="admin-form-label">
                    {t('admin.programs.fieldTermEnd', '학기 종료일 (선택)')}
                  </label>
                  <input
                    type="date"
                    id="term_end_date"
                    name="term_end_date"
                    value={formData.term_end_date}
                    onChange={handleChange}
                    className="admin-form-input"
                  />
                </div>
              </div>
              <p className="admin-form-help">
                {t(
                  'admin.programs.termHelp',
                  '학기 기간을 비우면 상시 수업으로 보고 매월 해당 요일에 계속 표시합니다.'
                )}
              </p>
              <div className="admin-form-group">
                <label className="admin-form-label">
                  {t('admin.programs.fieldExceptions', '예외 날짜 (휴강·보강)')}
                </label>
                <p className="admin-form-help">
                  {t(
                    'admin.programs.exceptionHelp',
                    '규칙이 흔들리는 달에 씁니다. 예를 들어 둘째·넷째 주 수업이 이번 달만 셋째·넷째 주가 되면, 둘째 주 날짜를 ‘쉼’으로, 셋째 주 날짜를 ‘추가’로 넣으면 됩니다. 휴강·보강도 같습니다.'
                  )}
                </p>
                <div className="admin-exception-add">
                  <input
                    type="date"
                    value={exceptionDraft}
                    onChange={(e) => setExceptionDraft(e.target.value)}
                    className="admin-form-input"
                    aria-label={t('admin.programs.exceptionDate', '예외 날짜')}
                  />
                  <button
                    type="button"
                    className="admin-btn admin-btn-outline admin-btn-sm"
                    onClick={() => addException('skip_dates')}
                    disabled={!exceptionDraft}
                  >
                    {t('admin.programs.exceptionAddSkip', '이 날 쉼')}
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-outline admin-btn-sm"
                    onClick={() => addException('extra_dates')}
                    disabled={!exceptionDraft}
                  >
                    {t('admin.programs.exceptionAddExtra', '이 날 추가')}
                  </button>
                </div>
                {(skipDates.length > 0 || extraDates.length > 0) && (
                  <div className="admin-exception-lists">
                    {skipDates.length > 0 && (
                      <div className="admin-exception-group">
                        <span className="admin-exception-title">
                          {t('admin.programs.exceptionSkipTitle', '쉬는 날')}
                        </span>
                        <div className="admin-exception-chips">
                          {skipDates.map((d) => (
                            <button
                              type="button"
                              key={d}
                              className="admin-exception-chip is-skip"
                              onClick={() => removeException('skip_dates', d)}
                              title={t('admin.programs.exceptionRemove', '클릭하면 지웁니다')}
                            >
                              {shortDate(t, d)} <span aria-hidden="true">×</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {extraDates.length > 0 && (
                      <div className="admin-exception-group">
                        <span className="admin-exception-title">
                          {t('admin.programs.exceptionExtraTitle', '추가하는 날')}
                        </span>
                        <div className="admin-exception-chips">
                          {extraDates.map((d) => (
                            <button
                              type="button"
                              key={d}
                              className="admin-exception-chip is-extra"
                              onClick={() => removeException('extra_dates', d)}
                              title={t('admin.programs.exceptionRemove', '클릭하면 지웁니다')}
                            >
                              {shortDate(t, d)} <span aria-hidden="true">×</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {schedulePreview && (
                <div className="admin-schedule-preview">
                  <span className="admin-schedule-preview-title">
                    {t('admin.programs.previewTitle', '캘린더에 표시될 날짜')}
                  </span>
                  {schedulePreview.map((m) => (
                    <div key={m.label} className="admin-schedule-preview-month">
                      <span className="admin-schedule-preview-month-label">{m.label}</span>
                      {m.dates.length > 0 ? (
                        <span className="admin-schedule-preview-dates">
                          {m.dates.map((d) => shortDate(t, d)).join(', ')}
                        </span>
                      ) : (
                        <span className="admin-schedule-preview-empty">
                          {t('admin.programs.previewNone', '표시되는 수업이 없습니다')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="admin-form-group">
                <label htmlFor="schedule_ko" className="admin-form-label">
                  {t('admin.programs.fieldScheduleKo', '수업 일정 안내 (한글)')}
                </label>
                <input
                  type="text"
                  id="schedule_ko"
                  name="schedule_ko"
                  value={formData.schedule_ko}
                  onChange={handleChange}
                  className="admin-form-input"
                  placeholder="매주 토요일 10:00~12:00"
                />
              </div>
              <div className="admin-form-group">
                <label htmlFor="schedule_en" className="admin-form-label">
                  {t('admin.programs.fieldScheduleEn', '수업 일정 안내 (영문)')}
                </label>
                <input
                  type="text"
                  id="schedule_en"
                  name="schedule_en"
                  value={formData.schedule_en}
                  onChange={handleChange}
                  className="admin-form-input"
                  placeholder="Every Saturday 10:00 AM - 12:00 PM"
                />
              </div>
            </>
          )}

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label htmlFor="location_ko" className="admin-form-label">
                {t('admin.common.fieldLocationKo', '장소 (한글)')}
              </label>
              <input
                type="text"
                id="location_ko"
                name="location_ko"
                value={formData.location_ko}
                onChange={handleChange}
                className="admin-form-input"
              />
            </div>
            <div className="admin-form-group">
              <label htmlFor="location_en" className="admin-form-label">
                {t('admin.common.fieldLocationEn', '장소 (영문)')}
              </label>
              <input
                type="text"
                id="location_en"
                name="location_en"
                value={formData.location_en}
                onChange={handleChange}
                className="admin-form-input"
              />
            </div>
          </div>
        </div>

        {/* 안내 정보 */}
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">{t('admin.programs.secInfo', '안내 정보')}</h3>
          <p className="admin-form-help">
            {t(
              'admin.programs.secInfoHelp',
              '금액은 자유 형식으로 입력하세요. 예: $250 / 2주, 문의, 무료'
            )}
          </p>
          <div className="admin-form-group">
            <label htmlFor="age_range" className="admin-form-label">
              {t('admin.programs.fieldAge', '대상 연령')}
            </label>
            <input
              type="text"
              id="age_range"
              name="age_range"
              value={formData.age_range}
              onChange={handleChange}
              className="admin-form-input"
              placeholder="7~12세 / Ages 7-12"
            />
          </div>
          <div className="admin-form-row">
            <div className="admin-form-group">
              <label htmlFor="price_ko" className="admin-form-label">
                {t('admin.programs.fieldPriceKo', '수강료/참가비 (한글)')}
              </label>
              <input
                type="text"
                id="price_ko"
                name="price_ko"
                value={formData.price_ko}
                onChange={handleChange}
                className="admin-form-input"
                placeholder="$250 / 2주"
              />
            </div>
            <div className="admin-form-group">
              <label htmlFor="price_en" className="admin-form-label">
                {t('admin.programs.fieldPriceEn', '수강료/참가비 (영문)')}
              </label>
              <input
                type="text"
                id="price_en"
                name="price_en"
                value={formData.price_en}
                onChange={handleChange}
                className="admin-form-input"
                placeholder="$250 / 2 weeks"
              />
            </div>
          </div>
        </div>

        {/* 준비물 */}
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">{t('admin.nav.supplies', '준비물')}</h3>
          <p className="admin-form-help">
            {t(
              'admin.programs.secSuppliesHelp',
              '이 수업·프로그램에 필요한 준비물을 카탈로그에서 골라 붙이세요. 개별 항목과 세트를 섞어 지정할 수 있습니다. 원생·학부모가 ‘내 수업’과 공개 상세에서 확인합니다.'
            )}
          </p>
          <SupplyPicker items={activeSupplies} value={supplies} onChange={setSupplies} />
          <div className="supply-picker-setblock">
            <span className="admin-form-label">{t('admin.programs.supplySets', '세트')}</span>
            <SetPicker sets={activeSupplySets} value={supplySets} onChange={setSupplySets} />
          </div>
        </div>

        {/* 사진 (편집 시에만) */}
        {!isNew && program && (
          <div className="admin-form-section">
            <h3 className="admin-form-section-title">{t('admin.common.colPhoto', '사진')}</h3>
            <p className="admin-form-help">
              {t(
                'admin.programs.photoHelp',
                '첫 번째 사진이 카드와 대표 이미지로 사용됩니다. 드래그로 순서를 바꿀 수 있습니다.'
              )}
            </p>
            <ProgramImageUploader
              programId={program.id}
              onUploadComplete={(newImages) => setImages((prev) => [...prev, ...newImages])}
            />
            {images.length > 0 && (
              <ProgramImageSortable
                programId={program.id}
                images={images}
                onReorder={setImages}
                onDelete={(imageId) =>
                  setImages((prev) => prev.filter((img) => img.id !== imageId))
                }
              />
            )}
          </div>
        )}

        {/* 신청 방법 — 신청서를 붙이면 상세 페이지의 신청 버튼이 그 신청서로 간다.
            붙이지 않으면 예전 신청 모달이 그대로 열린다(둘 중 하나만 동작한다). */}
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">
            {t('admin.programs.secApply', '신청 받기')}
          </h3>
          <div className="admin-field">
            <label htmlFor="active_form_id">
              {t('admin.programs.applyForm', '연결할 신청서')}
            </label>
            <select
              id="active_form_id"
              name="active_form_id"
              value={formData.active_form_id}
              onChange={handleChange}
            >
              <option value="">
                {t('admin.programs.applyFormNone', '연결 안 함 (예전 신청 모달 사용)')}
              </option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title_ko}
                  {f.status !== 'open' ? ' — 아직 게시 전' : ''}
                </option>
              ))}
            </select>
            <p className="admin-field-help">
              {t(
                'admin.programs.applyFormHelp',
                '신청서를 연결하면 이 수업 상세의 신청 버튼이 그 신청서를 엽니다. 게시하지 않은 신청서를 연결하면 버튼은 예전 방식 그대로 동작합니다.'
              )}
            </p>
          </div>
        </div>

        {/* 공개 설정 */}
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">
            {t('admin.common.secVisibility', '공개 설정')}
          </h3>
          <div className="admin-form-row">
            <div className="admin-form-checkbox">
              <input
                type="checkbox"
                id="is_published"
                name="is_published"
                checked={formData.is_published}
                onChange={handleChange}
              />
              <label htmlFor="is_published">
                {t(
                  'admin.programs.publishLabel',
                  '공개 (체크하면 사이트에 표시되고 신청을 받습니다)'
                )}
              </label>
            </div>
            <div className="admin-form-checkbox">
              <input
                type="checkbox"
                id="is_featured"
                name="is_featured"
                checked={formData.is_featured}
                onChange={handleChange}
              />
              <label htmlFor="is_featured">
                {t('admin.programs.featureLabel', '대표로 강조')}
                {isCamp ? ` ${t('admin.programs.featureCampNote', '(수업 페이지 상단 캠프 배너)')}` : ''}
              </label>
            </div>
          </div>
        </div>
      </div>

      {isNew && (
        <p className="admin-form-help" style={{ marginTop: '8px' }}>
          {t('admin.programs.newHint', '저장하면 편집 화면으로 이동해 사진을 추가할 수 있습니다.')}
        </p>
      )}

      <div className="admin-form-actions">
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={() => router.back()}
          disabled={saving}
        >
          {t('admin.common.cancel', '취소')}
        </button>
        <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
          {saving
            ? t('admin.common.saving', '저장 중...')
            : isNew
              ? t('admin.common.create', '생성')
              : t('admin.common.save', '저장')}
        </button>
      </div>
    </form>
  );
}

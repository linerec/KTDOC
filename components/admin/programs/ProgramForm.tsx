'use client';

/**
 * ProgramForm
 * 수업·프로그램·캠프 생성/편집 폼 (gallery EventForm 패턴).
 * 종류(program_type)에 따라 일정 입력이 달라집니다: 수업/프로그램은 요일·시간 텍스트, 캠프는 기간(시작~종료).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProgramDetail, CreateProgramInput, UpdateProgramInput, ProgramType } from '@/types/programs';
import { PROGRAM_TYPES } from '@/types/programs';
import { useT } from '@/lib/i18n/useT';
import { programTypeLabel } from '@/lib/i18n/programLabels';
import type { SupplyItem, SupplySetWithItems } from '@/types/supplies';
import ProgramImageUploader from './ProgramImageUploader';
import ProgramImageSortable from './ProgramImageSortable';
import SupplyPicker, { type PickerRow } from '@/components/admin/supplies/SupplyPicker';
import SetPicker, { type SetPickerRow } from '@/components/admin/supplies/SetPicker';

interface ProgramFormProps {
  program?: ProgramDetail | null;
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

export default function ProgramForm({
  program,
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
    class_start_time: program?.class_start_time || '',
    class_end_time: program?.class_end_time || '',
    term_start_date: program?.term_start_date?.split('T')[0] || '',
    term_end_date: program?.term_end_date?.split('T')[0] || '',
    is_published: program?.is_published === 1,
    is_featured: program?.is_featured === 1,
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
                  '요일·시간·학기 기간을 입력하면 원생·학부모 캘린더에 매주 자동으로 표시됩니다. 아래 ‘수업 일정 안내’는 공개 페이지에 보이는 보조 설명입니다.'
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

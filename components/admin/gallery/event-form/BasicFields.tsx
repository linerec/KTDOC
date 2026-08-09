'use client';

/**
 * 공연이 '무엇인가' — 종류·제목·날짜·카테고리
 *
 * 종류(공연/학내 행사)를 맨 앞에 둔 이유: 이 선택이 공개 사이트에서의 취급과
 * 아래 쇼케이스 필드의 표시 여부까지 바꾸기 때문이다.
 */

import type { EventCategory } from '@/types/gallery';
import { useT } from '@/lib/i18n/useT';
import { useLocaleText } from '@/components/common/LocaleText';
import type { FieldGroupProps } from './types';

interface BasicFieldsProps extends FieldGroupProps {
  categories: EventCategory[];
}

export default function BasicFields({ formData, onChange, categories }: BasicFieldsProps) {
  const t = useT();
  const pick = useLocaleText();

  return (
    <>
      {/* 종류 — 공연인지 학내 행사인지에 따라 공개 사이트에서의 취급이 달라진다 */}
      <div className="admin-form-group">
        <span className="admin-form-label">{t('admin.events.fieldKind', '종류')}</span>
        <div
          className="event-kind-radios"
          role="radiogroup"
          aria-label={t('admin.events.kindAria', '행사 종류')}
        >
          <label className="event-kind-radio">
            <input
              type="radio"
              name="kind"
              value="performance"
              checked={formData.kind === 'performance'}
              onChange={onChange}
            />
            <span>{t('admin.schedule.typePerformance', '공연')}</span>
          </label>
          <label className="event-kind-radio">
            <input
              type="radio"
              name="kind"
              value="school"
              checked={formData.kind === 'school'}
              onChange={onChange}
            />
            <span>{t('admin.schedule.typeSchool', '학내 행사')}</span>
          </label>
        </div>
        <p className="admin-form-help">
          {t(
            'admin.events.kindHelp',
            '수료식·발표회처럼 학원에서 여는 행사는 ‘학내 행사’를 선택합니다. 공연 페이지에는 표시되지 않고, 발자취·갤러리에 기록으로 남습니다.'
          )}
        </p>
      </div>

      {/* 한/영 병기 필드는 좌우 2단으로 나란히 — 비교하며 입력 */}
      <div className="admin-form-bilingual">
        <div className="admin-form-group">
          <label htmlFor="title_ko" className="admin-form-label">
            {t('admin.common.fieldTitleKo', '제목 (한글)')} <span className="required">*</span>
          </label>
          <input
            type="text"
            id="title_ko"
            name="title_ko"
            value={formData.title_ko}
            onChange={onChange}
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
            onChange={onChange}
            className="admin-form-input"
          />
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-form-group">
          <label htmlFor="event_date" className="admin-form-label">
            {t('admin.events.fieldDate', '행사 날짜')} <span className="required">*</span>
          </label>
          <input
            type="date"
            id="event_date"
            name="event_date"
            value={formData.event_date}
            onChange={onChange}
            required
            className="admin-form-input"
          />
        </div>

        <div className="admin-form-group">
          <label htmlFor="category_id" className="admin-form-label">
            {t('admin.events.fieldCategory', '카테고리')}
          </label>
          <select
            id="category_id"
            name="category_id"
            value={formData.category_id}
            onChange={onChange}
            className="admin-form-select"
          >
            <option value="">{t('admin.events.categoryNone', '선택 안함')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {pick(cat.name_ko, cat.name_en)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}

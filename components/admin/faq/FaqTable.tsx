'use client';

/** Q&A 목록 — 질문을 누르면 편집 패널이 열린다 */

import type { FaqItem } from '@/types/faq';
import { useT } from '@/lib/i18n/useT';

interface FaqTableProps {
  items: FaqItem[];
  busyId: number | null;
  onEdit: (item: FaqItem) => void;
  onTogglePublish: (item: FaqItem) => void;
  onDelete: (item: FaqItem) => void;
}

export default function FaqTable({
  items,
  busyId,
  onEdit,
  onTogglePublish,
  onDelete,
}: FaqTableProps) {
  const t = useT();

  /** '공통' 또는 '2026 · 봄 정기공연' */
  const targetLabel = (item: FaqItem) =>
    item.event_id === null
      ? t('admin.faq.targetGeneral', '공통')
      : `${item.event_year} · ${item.event_title_ko ?? `#${item.event_id}`}`;

  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t('admin.faq.question', '질문')}</th>
            <th style={{ width: '220px' }}>{t('admin.faq.target', '대상')}</th>
            <th style={{ width: '70px' }}>{t('admin.faq.order', '순서')}</th>
            <th style={{ width: '92px' }}>{t('admin.common.colPublished', '공개 상태')}</th>
            <th style={{ width: '120px' }}>{t('admin.news.colAuthor', '작성자')}</th>
            <th style={{ width: '160px' }}>{t('admin.common.colActions', '작업')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <button
                  type="button"
                  className="admin-table-link faq-question-link"
                  onClick={() => onEdit(item)}
                >
                  <span className="admin-table-title">{item.question}</span>
                  <span className="admin-table-subtitle faq-answer-preview">{item.answer}</span>
                </button>
              </td>
              <td>{targetLabel(item)}</td>
              <td>{item.sort_order}</td>
              <td>
                <button
                  type="button"
                  className={`admin-badge ${
                    item.is_published ? 'admin-badge-success' : 'admin-badge-muted'
                  }`}
                  onClick={() => onTogglePublish(item)}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id
                    ? '...'
                    : item.is_published
                      ? t('admin.common.published', '공개')
                      : t('admin.common.unpublished', '비공개')}
                </button>
              </td>
              <td>{item.created_by || <span className="admin-table-muted">-</span>}</td>
              <td>
                <div className="admin-table-actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm"
                    onClick={() => onEdit(item)}
                  >
                    {t('admin.common.edit', '편집')}
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-danger"
                    onClick={() => onDelete(item)}
                    disabled={busyId === item.id}
                  >
                    {busyId === item.id ? '...' : t('admin.common.delete', '삭제')}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

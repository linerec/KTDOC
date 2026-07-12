'use client';

/**
 * CategoryManagerModal — '공연 관리' 페이지의 카테고리 관리 모달
 *
 * 별도 메뉴/페이지 없이 버튼을 누르면 모달이 열리고, 그 안에서 카테고리를 CRUD 한다.
 * 변경이 성공할 때마다 onChanged(router.refresh)로 부모 서버 컴포넌트를 다시 불러와
 * 이 페이지의 분류 필터 드롭다운에 즉시 반영한다.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CategoryManager from './CategoryManager';
import type { EventCategory } from '@/types/gallery';

interface CategoryManagerModalProps {
  initialCategories: EventCategory[];
}

export default function CategoryManagerModal({
  initialCategories,
}: CategoryManagerModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        className="admin-btn admin-btn-outline"
        onClick={() => setOpen(true)}
      >
        공연 카테고리
      </button>

      {open && (
        <div className="photo-modal-scrim" onClick={close}>
          <div
            className="photo-modal photo-modal--wide"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="공연 카테고리 관리"
          >
            <div className="photo-modal-head">
              <h3>공연 카테고리</h3>
              <button
                type="button"
                className="photo-modal-close"
                onClick={close}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <p className="admin-form-help">
              방문자가 갤러리 페이지에서 공연을 분류해 볼 때 쓰는 카테고리입니다. 저장하면 이 페이지의 분류 필터에 바로 반영됩니다.
            </p>

            <CategoryManager
              initialCategories={initialCategories}
              onChanged={() => router.refresh()}
            />

            <div className="photo-modal-actions">
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={close}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

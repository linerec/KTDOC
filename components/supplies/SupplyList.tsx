/**
 * SupplyList (준비물 표시)
 * 이벤트·수업 상세에서 '무엇을 챙겨야 하는지' 보여주는 공용 서버 컴포넌트.
 * 개별 항목(사진·이름·수량·필수·말모이 발음)과 세트(묶음명 + 포함 항목)를 함께 표시한다.
 */

import Image from 'next/image';
import Link from 'next/link';
import type { SupplyLinkWithItem, SupplySetLinkWithItems } from '@/types/supplies';

interface Props {
  supplies: SupplyLinkWithItem[];
  sets?: SupplySetLinkWithItems[];
  /** 섹션 제목(기본: 준비물 · What to Bring). */
  heading?: string;
}

export default function SupplyList({ supplies, sets = [], heading = '준비물 · What to Bring' }: Props) {
  const hasItems = supplies && supplies.length > 0;
  const hasSets = sets && sets.length > 0;
  if (!hasItems && !hasSets) return null;

  return (
    <section className="supply-list-section">
      <h3 className="supply-list-heading">{heading}</h3>
      <ul className="supply-list">
        {/* 세트(묶음) 먼저 */}
        {sets.map((s) => (
          <li key={`set-${s.id}`} className={`supply-list-item supply-set-item${s.is_required ? '' : ' is-optional'}`}>
            <span className="supply-list-thumb" aria-hidden="true">
              <span className="supply-list-img-placeholder">📦</span>
            </span>
            <span className="supply-list-body">
              <span className="supply-list-name">
                {s.name_ko}
                {s.name_en && <span className="supply-list-name-en">{s.name_en}</span>}
                <span className="supply-badge supply-badge-set">세트</span>
                {s.is_required ? (
                  <span className="supply-badge supply-badge-req">필수</span>
                ) : (
                  <span className="supply-badge supply-badge-opt">선택</span>
                )}
              </span>
              {s.quantity && <span className="supply-list-meta"><span className="supply-list-qty">{s.quantity}</span></span>}
              {s.items.length > 0 && (
                <ul className="supply-set-members">
                  {s.items.map((it) => (
                    <li key={it.supply_item_id} className="supply-set-member">
                      {it.name_ko}
                      {it.term_pronunciation && (
                        <span className="supply-set-member-pron"> / {it.term_pronunciation} /</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {s.note_ko && <span className="supply-list-note">{s.note_ko}</span>}
            </span>
          </li>
        ))}

        {/* 개별 항목 */}
        {supplies.map((s) => (
          <li key={`item-${s.id}`} className={`supply-list-item${s.is_required ? '' : ' is-optional'}`}>
            <span className="supply-list-thumb" aria-hidden="true">
              {s.image_url ? (
                <Image src={s.image_url} alt="" width={48} height={48} className="supply-list-img" />
              ) : (
                <span className="supply-list-img-placeholder">🎒</span>
              )}
            </span>
            <span className="supply-list-body">
              <span className="supply-list-name">
                {s.name_ko}
                {s.name_en && <span className="supply-list-name-en">{s.name_en}</span>}
                {s.is_required ? (
                  <span className="supply-badge supply-badge-req">필수</span>
                ) : (
                  <span className="supply-badge supply-badge-opt">선택</span>
                )}
              </span>

              {(s.quantity || s.term_pronunciation) && (
                <span className="supply-list-meta">
                  {s.quantity && <span className="supply-list-qty">{s.quantity}</span>}
                  {s.term_pronunciation && (
                    <span className="supply-list-pron">/ {s.term_pronunciation} /</span>
                  )}
                  {s.term_slug && (
                    <Link href="/glossary" className="supply-list-term-link">
                      말모이에서 보기
                    </Link>
                  )}
                </span>
              )}

              {s.note_ko && <span className="supply-list-note">{s.note_ko}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

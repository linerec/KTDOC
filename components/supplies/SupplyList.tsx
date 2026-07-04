/**
 * SupplyList (준비물 표시)
 * 이벤트·수업 상세에서 '무엇을 챙겨야 하는지' 보여주는 공용 서버 컴포넌트.
 * 사진·이름(한/영)·수량·필수 배지, 연결된 말모이 용어의 발음·링크를 표시한다.
 */

import Image from 'next/image';
import Link from 'next/link';
import type { SupplyLinkWithItem } from '@/types/supplies';

interface Props {
  supplies: SupplyLinkWithItem[];
  /** 섹션 제목(기본: 준비물 · What to Bring). 컨텍스트에 맞게 덮어쓸 수 있다. */
  heading?: string;
}

export default function SupplyList({ supplies, heading = '준비물 · What to Bring' }: Props) {
  if (!supplies || supplies.length === 0) return null;

  return (
    <section className="supply-list-section">
      <h3 className="supply-list-heading">{heading}</h3>
      <ul className="supply-list">
        {supplies.map((s) => (
          <li key={s.id} className={`supply-list-item${s.is_required ? '' : ' is-optional'}`}>
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

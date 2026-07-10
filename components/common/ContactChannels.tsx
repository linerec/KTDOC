'use client';

/**
 * 문의 채널 버튼(전화·카카오톡) — 어떤 화면에서든 "사람에게 닿는 길"을
 * 한 번의 탭으로 제공한다(신뢰·접근성 개선 Phase Step 4).
 *
 * 연락처는 SEO 패널(/admin/seo → D1 seo.business)을 단일 소스로 쓰며,
 * 값이 없는 채널은 렌더하지 않는다(둘 다 없으면 아무것도 그리지 않음).
 */

import { useLanguage } from '@/contexts/LanguageContext';
import { useSiteBusiness } from '@/contexts/SiteBusinessContext';
import { telHref } from '@/lib/seoBusiness';

interface ContactChannelsProps {
  className?: string;
  /** 전화 버튼 라벨 옆에 번호를 함께 표시(전화로 걸 수 없는 데스크톱 대비) */
  showNumber?: boolean;
}

export default function ContactChannels({
  className = '',
  showNumber = true,
}: ContactChannelsProps) {
  const { messages } = useLanguage();
  const business = useSiteBusiness();

  if (!business.telephone && !business.kakao) return null;

  return (
    <div className={`contact-channels ${className}`.trim()}>
      {business.telephone && (
        <a href={telHref(business.telephone)} className="contact-btn contact-btn--tel">
          {messages['contact.call']}
          {showNumber && <span className="contact-btn-detail">{business.telephone}</span>}
        </a>
      )}
      {business.kakao && (
        <a
          href={business.kakao}
          target="_blank"
          rel="noopener noreferrer"
          className="contact-btn contact-btn--kakao"
        >
          {messages['contact.kakao']}
        </a>
      )}
    </div>
  );
}

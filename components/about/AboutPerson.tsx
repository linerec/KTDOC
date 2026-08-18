'use client';

/**
 * 인물 소개 — 원장(안은희)과 강사(백수경)가 같은 골격을 쓰고 크기만 다르다.
 *
 * 나란히 같은 크기로 놓으면 두 사람의 위계가 사라지고, 완전히 다른 모양으로 만들면
 * 한 페이지 안에서 남의 집처럼 보인다. 그래서 골격은 하나로 두고 `scale` 로 사진 폭과
 * 제목 크기만 바꾼다.
 *
 * 목록(주요 무대·수상·경력)은 IntlObject 대신 useT 를 쓴다 — 줄바꿈으로 나뉜 한 덩어리
 * 문자열을 <li> 로 쪼개야 해서 래퍼를 붙일 수 없는 자리다(CLAUDE.md 의 i18n 규칙).
 * 운영자는 관리 콘솔에서 이 값을 한 상자에서 줄 단위로 고친다.
 */

import type { CSSProperties, ReactNode } from 'react';
import { useT } from '@/lib/i18n/useT';
import ImageObject from '@/components/common/ImageObject';

export interface AboutPersonProps {
  /** locale 키 접두사 — 'about.director' | 'about.instructor' */
  prefix: string;
  /** 사진 keycode(관리 콘솔에서 교체 가능) + 번들 폴백 */
  imageKeycode: string;
  imageFallback: string;
  imageAlt: string;
  /** 'lead' = 원장(크게), 'support' = 강사(한 단계 작게) */
  scale: 'lead' | 'support';
  /** 이름·직함을 별도 키로 갖는 경우(원장은 기존 title.ko/title.en 을 쓴다) */
  nameKey?: string;
  roleKey?: string;
}

/**
 * 본문에 섞여 들어온 **굵게** 를 <strong> 으로 바꾼다.
 * 원장님이 메일 원문을 관리 콘솔에 그대로 붙여 넣으시면 별표가 글자로 새어 나온다.
 * 편집자에게 규칙을 지키라고 하는 대신 화면이 받아 준다.
 */
function renderInlineBold(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((chunk, i) =>
    i % 2 === 1 ? <strong key={i}>{chunk}</strong> : <span key={i}>{chunk}</span>
  );
}

/** 줄바꿈으로 나뉜 한 덩어리 문자열을 항목 배열로. 빈 줄은 버린다. */
function toLines(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function PersonList({ label, items, variant }: { label: string; items: string[]; variant: string }) {
  if (items.length === 0) return null;
  return (
    <div className={`about-person-block about-person-block--${variant}`}>
      <h4 className="about-person-block-label">{label}</h4>
      <ul className="about-person-block-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function AboutPerson({
  prefix,
  imageKeycode,
  imageFallback,
  imageAlt,
  scale,
  nameKey,
  roleKey,
}: AboutPersonProps) {
  const t = useT();

  const name = t(nameKey ?? `${prefix}.title.ko`, '');
  const role = t(roleKey ?? `${prefix}.title.en`, '');
  const roles = t(`${prefix}.roles`, '');
  const greeting = t(`${prefix}.greeting`, '');
  // 본문은 한 곳에서만 온다(D1 오버라이드가 있으면 그쪽이 실내용).
  // 두 문단까지는 그냥 보여주고, 그보다 길면 첫 문단만 펼쳐 두고 나머지를 접는다 —
  // 네 문단짜리 약력을 통째로 깔면 스캔하는 눈이 그냥 지나친다.
  const paragraphs = toLines(t(`${prefix}.bio`, '') || t(`${prefix}.bio1`, ''));
  const intro = paragraphs.length <= 2 ? paragraphs : paragraphs.slice(0, 1);
  const rest = paragraphs.length <= 2 ? [] : paragraphs.slice(1);
  const fullBioLabel = t(`${prefix}.bioFullLabel`, '약력 전체 보기');

  // 목록 세 종류 — 인물마다 있는 것만 그린다
  const stages = toLines(t(`${prefix}.stages`, ''));
  const awards = toLines(t(`${prefix}.awards`, ''));
  const career = toLines(t(`${prefix}.career`, ''));

  return (
    <div className={`about-person about-person--${scale}`}>
      <div className="about-person-portrait reveal reveal--up">
        <ImageObject
          keycode={imageKeycode}
          width={752}
          height={922}
          className="about-person-portrait-img"
          containerClassName="about-person-portrait-fill"
          fallbackSrc={imageFallback}
          alt={imageAlt}
          imageStyle={{ width: '100%', height: 'auto' }}
        />
      </div>

      <div className="about-person-body reveal reveal--up" style={{ '--reveal-delay': '120ms' } as CSSProperties}>
        <h3 className="about-person-name">{name}</h3>
        {role && <p className="about-person-role">{role}</p>}
        {roles && <p className="about-person-affiliations">{roles}</p>}

        {/* 인사말은 아직 받지 못했다. 값이 채워지면 여기 그대로 얹힌다. */}
        {greeting && <p className="about-person-greeting">{greeting}</p>}

        {intro.map((paragraph) => (
          <p className="about-person-bio" key={paragraph.slice(0, 24)}>
            {renderInlineBold(paragraph)}
          </p>
        ))}

        {/* 장소 이름은 문장에 묻으면 스캔하는 눈에 안 걸린다 — 이름만 떨어뜨려 놓는다 */}
        <PersonList label={t(`${prefix}.stagesLabel`, '주요 무대')} items={stages} variant="stages" />
        <PersonList label={t(`${prefix}.awardsLabel`, '수상')} items={awards} variant="awards" />
        <PersonList label={t(`${prefix}.careerLabel`, '주요 경력')} items={career} variant="career" />

        {/* 전문은 접어 둔다. <details> 라 JS 없이 열리고, 접힌 내용도 검색엔진이 읽는다. */}
        {rest.length > 0 && (
          <details className="about-person-more">
            <summary className="about-person-more-summary">{fullBioLabel}</summary>
            <div className="about-person-more-body">
              {rest.map((paragraph) => (
                <p key={paragraph.slice(0, 24)}>{renderInlineBold(paragraph)}</p>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

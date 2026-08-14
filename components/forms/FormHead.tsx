'use client';

/**
 * FormHead — 신청서 머리말과 언어 전환
 *
 * 머리말이 클라이언트인 이유: 제목·안내문이 서버에서 한국어로 굳으면 언어를
 * 바꿔도 문항만 영어가 되고 위쪽은 한국어로 남는다. 반만 바뀌는 화면은
 * 안 바뀌는 화면보다 나쁘다.
 *
 * 전환 버튼을 헤더의 것과 별도로 폼 안에 두는 이유: 이 페이지는 링크·QR로 처음
 * 들어오는 자리다. 영어가 편한 학부모가 헤더 구석의 'en'을 찾아 헤매게 두지 않는다.
 * 그래서 'ko/en'이 아니라 **한국어 / English** 로 적는다 — 읽을 줄 아는 말로 써야
 * 자기 말을 찾을 수 있다.
 */

import { useLanguage } from '@/contexts/LanguageContext';

const LANG_LABEL: Record<string, string> = { ko: '한국어', en: 'English' };

interface FormHeadProps {
  season: string | null;
  titleKo: string;
  titleEn: string | null;
  descriptionKo: string | null;
  descriptionEn: string | null;
}

export default function FormHead({
  season,
  titleKo,
  titleEn,
  descriptionKo,
  descriptionEn,
}: FormHeadProps) {
  const { locale, changeLanguage, availableLangs } = useLanguage();
  const isEn = locale === 'en';

  // en 이 비어 있으면 ko 로 폴백한다 — 번역이 덜 된 신청서가 빈 화면이 되면 안 된다.
  const title = isEn ? titleEn || titleKo : titleKo;
  const description = isEn ? descriptionEn || descriptionKo : descriptionKo;
  // 한국어로 볼 때만 영문 제목을 부제로 함께 보인다. 영어를 고른 사람에게
  // 한국어 부제를 다시 얹는 것은 되돌아가는 일이다.
  const sub = !isEn && titleEn ? titleEn : null;

  return (
    <header className="form-head">
      <div className="form-lang" role="group" aria-label="Language / 언어">
        {availableLangs.map((lang) => (
          <button
            key={lang}
            type="button"
            className={`form-lang-btn${locale === lang ? ' is-active' : ''}`}
            aria-pressed={locale === lang}
            onClick={() => changeLanguage(lang)}
          >
            {LANG_LABEL[lang] ?? lang}
          </button>
        ))}
      </div>

      {season && <p className="form-season">{season}</p>}
      <h1 className="form-title">{title}</h1>
      {sub && <p className="form-title-en">{sub}</p>}
      {description && <p className="form-desc">{description}</p>}
    </header>
  );
}

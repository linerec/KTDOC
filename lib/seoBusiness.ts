/**
 * SEO 비즈니스 정보(NAP) — 로컬 SEO의 단일 진실의 원천(SSOT)
 *
 * 관리자가 /admin/seo 패널에서 입력한 상호·주소·전화(NAP)·운영시간을
 * D1 site_settings('seo.business')에 JSON으로 저장하고,
 *  - 푸터의 표시용 연락처 블록과
 *  - <head>의 LocalBusiness JSON-LD 구조화 데이터가
 * 같은 값을 소비한다. 두 곳의 NAP가 어긋나면 로컬 SEO 신뢰도가 떨어지므로
 * 반드시 이 모듈을 거쳐 읽는다.
 *
 * DB 의존성이 없는 순수 모듈 — 서버/클라이언트 어디서나 import 가능.
 */

/** 사이트 대표 URL (metadataBase·JSON-LD url과 동일해야 한다) */
export const SITE_URL = 'https://ktdoc.org';

/** site_settings 키 (app/api/admin/settings ALLOWED_KEYS에 등록됨) */
export const SETTING_SEO_BUSINESS = 'seo.business';

/** schema.org dayOfWeek 값(키)과 표시 라벨 */
export const BUSINESS_DAYS = [
  { key: 'Monday', ko: '월', en: 'Mon' },
  { key: 'Tuesday', ko: '화', en: 'Tue' },
  { key: 'Wednesday', ko: '수', en: 'Wed' },
  { key: 'Thursday', ko: '목', en: 'Thu' },
  { key: 'Friday', ko: '금', en: 'Fri' },
  { key: 'Saturday', ko: '토', en: 'Sat' },
  { key: 'Sunday', ko: '일', en: 'Sun' },
] as const;

export type BusinessDayKey = (typeof BUSINESS_DAYS)[number]['key'];

/** 요일별 운영시간 1건 (opens/closes는 24시간 "HH:MM") */
export interface BusinessHoursEntry {
  day: BusinessDayKey;
  opens: string;
  closes: string;
}

export interface SeoBusinessInfo {
  /** 상호 — Google 비즈니스 프로필(GBP)과 글자 단위로 동일하게 */
  nameKo: string;
  nameEn: string;
  /** 소개문(검색 결과·구조화 데이터용 한두 문장) */
  descriptionKo: string;
  descriptionEn: string;
  /** 주소(NAP) — GBP와 동일한 표기 형식 유지 */
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
  /** 대표 전화(+1-XXX-XXX-XXXX 권장)·이메일 */
  telephone: string;
  email: string;
  /** 좌표(선택) — 소수점 5자리 이상 권장 */
  latitude: string;
  longitude: string;
  /** 가격대(선택, 예: "$$", 100자 미만) */
  priceRange: string;
  /** 서비스 지역(선택, 쉼표 구분: "Palisades Park, Fort Lee, Bergen County") */
  areaServed: string;
  /** 운영시간 — 비운 요일은 휴무로 간주 */
  hours: BusinessHoursEntry[];
  /** SNS·지도 프로필(sameAs/hasMap) */
  instagram: string;
  youtube: string;
  googleMaps: string;
  /** 카카오톡 채널 URL(예: https://pf.kakao.com/_abc) — 사이트 곳곳의 문의 버튼에 노출 */
  kakao: string;
}

export const DEFAULT_SEO_BUSINESS: SeoBusinessInfo = {
  nameKo: '춤누리 한국전통무용학원',
  nameEn: 'Korean Traditional Dance of Choomnoori',
  descriptionKo: '',
  descriptionEn: '',
  streetAddress: '',
  addressLocality: '',
  addressRegion: 'NJ',
  postalCode: '',
  addressCountry: 'US',
  telephone: '',
  email: '',
  latitude: '',
  longitude: '',
  priceRange: '',
  areaServed: '',
  hours: [],
  instagram: 'https://www.instagram.com/ktdoc_choomnoori/',
  youtube: 'https://www.youtube.com/@ktdoc1737',
  googleMaps: '',
  kakao: '',
};

const DAY_KEYS = new Set<string>(BUSINESS_DAYS.map((d) => d.key));
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

/**
 * 저장된 JSON을 안전하게 파싱. 손상·누락 필드는 기본값으로 채워
 * 소비처(푸터·JSON-LD)가 항상 완전한 객체를 받게 한다.
 */
export function parseSeoBusiness(raw: string | null | undefined): SeoBusinessInfo {
  if (!raw) return DEFAULT_SEO_BUSINESS;
  try {
    const data = JSON.parse(raw) as Partial<Record<keyof SeoBusinessInfo, unknown>>;
    if (!data || typeof data !== 'object') return DEFAULT_SEO_BUSINESS;

    const hours: BusinessHoursEntry[] = Array.isArray(data.hours)
      ? (data.hours as unknown[]).flatMap((row) => {
          if (!row || typeof row !== 'object') return [];
          const { day, opens, closes } = row as Record<string, unknown>;
          if (
            typeof day !== 'string' || !DAY_KEYS.has(day) ||
            typeof opens !== 'string' || !TIME_RE.test(opens) ||
            typeof closes !== 'string' || !TIME_RE.test(closes)
          ) {
            return [];
          }
          return [{ day: day as BusinessDayKey, opens, closes }];
        })
      : [];

    const d = DEFAULT_SEO_BUSINESS;
    return {
      nameKo: asString(data.nameKo, d.nameKo),
      nameEn: asString(data.nameEn, d.nameEn),
      descriptionKo: asString(data.descriptionKo, d.descriptionKo),
      descriptionEn: asString(data.descriptionEn, d.descriptionEn),
      streetAddress: asString(data.streetAddress, d.streetAddress),
      addressLocality: asString(data.addressLocality, d.addressLocality),
      addressRegion: asString(data.addressRegion, d.addressRegion),
      postalCode: asString(data.postalCode, d.postalCode),
      addressCountry: asString(data.addressCountry, d.addressCountry),
      telephone: asString(data.telephone, d.telephone),
      email: asString(data.email, d.email),
      latitude: asString(data.latitude, d.latitude),
      longitude: asString(data.longitude, d.longitude),
      priceRange: asString(data.priceRange, d.priceRange),
      areaServed: asString(data.areaServed, d.areaServed),
      hours,
      instagram: asString(data.instagram, d.instagram),
      youtube: asString(data.youtube, d.youtube),
      googleMaps: asString(data.googleMaps, d.googleMaps),
      kakao: asString(data.kakao, d.kakao),
    };
  } catch {
    return DEFAULT_SEO_BUSINESS;
  }
}

/** 주소 필수 4요소(도로명·시·주·우편번호)가 모두 입력됐는지 — LocalBusiness 승격 조건 */
export function hasFullAddress(info: SeoBusinessInfo): boolean {
  return Boolean(
    info.streetAddress && info.addressLocality && info.addressRegion && info.postalCode
  );
}

/** 미국식 한 줄 주소 표기 (푸터·GBP 대조용) */
export function formatAddressLine(info: SeoBusinessInfo): string {
  if (!hasFullAddress(info)) return '';
  return `${info.streetAddress}, ${info.addressLocality}, ${info.addressRegion} ${info.postalCode}`;
}

/** tel: 링크용 — 숫자와 +만 남긴다 */
export function telHref(telephone: string): string {
  return `tel:${telephone.replace(/[^+\d]/g, '')}`;
}

/** 같은 시간대 요일을 한 줄로 묶는다(요일 순서 보존). 푸터 표시·JSON-LD 공용. */
export function groupBusinessHours(
  hours: BusinessHoursEntry[]
): { days: BusinessDayKey[]; opens: string; closes: string }[] {
  const groups: { days: BusinessDayKey[]; opens: string; closes: string }[] = [];
  for (const { key } of BUSINESS_DAYS) {
    const entry = hours.find((h) => h.day === key);
    if (!entry) continue;
    const existing = groups.find((g) => g.opens === entry.opens && g.closes === entry.closes);
    if (existing) {
      existing.days.push(key);
    } else {
      groups.push({ days: [key], opens: entry.opens, closes: entry.closes });
    }
  }
  return groups;
}

/**
 * <head>에 삽입할 schema.org JSON-LD 객체.
 *
 * 주소(NAP)가 완성되면 LocalBusiness(+EducationalOrganization 다중 타입)로,
 * 아직이면 Organization으로 게시한다 — 불완전한 LocalBusiness는 오히려 감점 요인.
 * Google 권장: name·address 필수, telephone·url·geo·openingHoursSpecification·
 * priceRange·image·sameAs 권장, 타입은 배열로 다중 지정.
 */
export function buildBusinessJsonLd(
  info: SeoBusinessInfo,
  siteUrl: string = SITE_URL
): Record<string, unknown> {
  const name = info.nameEn || info.nameKo;
  const alternateName = info.nameEn && info.nameKo && info.nameEn !== info.nameKo
    ? info.nameKo
    : undefined;
  const description = info.descriptionEn || info.descriptionKo || undefined;
  const sameAs = [info.instagram, info.youtube, info.kakao].filter(Boolean);

  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@id': `${siteUrl}/#organization`,
    name,
    url: siteUrl,
    logo: `${siteUrl}/assets/logo/logo_default.png`,
    image: `${siteUrl}/og-image.jpg`,
  };
  if (alternateName) base.alternateName = alternateName;
  if (description) base.description = description;
  if (sameAs.length > 0) base.sameAs = sameAs;
  if (info.email) base.email = info.email;

  if (!hasFullAddress(info)) {
    return { ...base, '@type': 'Organization' };
  }

  const jsonLd: Record<string, unknown> = {
    ...base,
    '@type': ['LocalBusiness', 'EducationalOrganization'],
    address: {
      '@type': 'PostalAddress',
      streetAddress: info.streetAddress,
      addressLocality: info.addressLocality,
      addressRegion: info.addressRegion,
      postalCode: info.postalCode,
      addressCountry: info.addressCountry || 'US',
    },
  };

  if (info.telephone) jsonLd.telephone = info.telephone;
  if (info.priceRange) jsonLd.priceRange = info.priceRange;
  if (info.googleMaps) jsonLd.hasMap = info.googleMaps;

  const lat = Number(info.latitude);
  const lng = Number(info.longitude);
  if (info.latitude && info.longitude && Number.isFinite(lat) && Number.isFinite(lng)) {
    jsonLd.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
  }

  const areaServed = info.areaServed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (areaServed.length > 0) {
    jsonLd.areaServed = areaServed.length === 1 ? areaServed[0] : areaServed;
  }

  const hourGroups = groupBusinessHours(info.hours);
  if (hourGroups.length > 0) {
    jsonLd.openingHoursSpecification = hourGroups.map((g) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: g.days.length === 1 ? g.days[0] : g.days,
      opens: g.opens,
      closes: g.closes,
    }));
  }

  return jsonLd;
}

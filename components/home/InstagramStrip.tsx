/**
 * InstagramStrip — 홈 인스타그램 하이라이트 (서버)
 *
 * 설정(social.instagram)만 읽어 뷰에 넘긴다. 계정 URL은 뷰가 SiteBusinessContext에서
 * 가져오므로(SEO 패널의 값과 항상 일치) 여기서 다루지 않는다.
 *
 * 렌더 여부 판단은 뷰(클라이언트)가 한다 — 빈 상태에서 편집 모드면 섹션을 띄워야
 * 첫 등록 진입점이 생기는데, isEditMode는 클라이언트 상태라 서버가 알 수 없다.
 *
 * 설계: docs/operations/instagram-highlights.md
 */

import { getSetting } from '@/lib/d1';
import { SETTING_SOCIAL_INSTAGRAM, parseInstagramHighlights } from '@/lib/socialHighlights';
import InstagramStripView from './InstagramStripView';

export default async function InstagramStrip() {
  // 설정 조회가 실패해도 홈이 깨지지 않도록 빈 배열로 폴백
  const raw = await getSetting(SETTING_SOCIAL_INSTAGRAM).catch(() => null);
  return <InstagramStripView items={parseInstagramHighlights(raw)} />;
}

-- Migration: 이벤트 구조화 위치 정보(주소·좌표)
-- Target DB: Cloudflare D1 (SQLite). 기존 location(장소명)·location_url(수동 링크)에 더해
-- 지오코딩 결과를 저장해 상세 페이지에서 지도를 직접 렌더링한다.
-- Description:
--   - location_address: 지오코딩된 표시용 전체 주소 (예: "100 Grove St, Jersey City, NJ 07302")
--   - location_lat / location_lng: WGS84 좌표 — 지도 임베드·길찾기 링크 생성의 원본
--   모두 nullable, additive. 좌표가 없으면 기존 location_url 링크 동작으로 폴백한다.
-- Apply: npm run d1:migrate migrations/0022_event_location.sql

ALTER TABLE events ADD COLUMN location_address TEXT;
ALTER TABLE events ADD COLUMN location_lat REAL;
ALTER TABLE events ADD COLUMN location_lng REAL;

-- 공개 이벤트 상세 '오시는 길' 섹션 i18n 문구 (ko/en). locale/*.json 기본값과 동일하게 유지.
INSERT INTO locale_content (keycode, ko, en) VALUES ('gallery.detail.location', '오시는 길', 'Location')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('gallery.detail.directions', '길찾기', 'Directions')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('gallery.detail.largerMap', '큰 지도로 보기', 'View larger map')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');

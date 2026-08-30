-- 0041: 사진 원본 보관 (Cloudflare D1)
--
-- 사진이 브라우저에서 R2로 곧장 올라가게 되면서(4.5MB 벽 제거), 원본을 줄이지
-- 않고 그대로 받을 수 있게 됐다. 화면에 뿌리는 것은 예전처럼 정규화된 사진
-- (장변 2000·WebP)이고, 원본은 originals/ 아래에 따로 눕는다.
--
-- 이 칸은 그 원본을 가리킨다. 없으면 NULL — 정규화가 필요 없었던 사진(작은
-- PNG·GIF 등)은 올라온 파일 한 장이 곧 표시본이라 원본이 따로 없다.
--
-- 왜 필요한가: 사진을 지울 때 표시본만 지우면 원본이 버킷에 남아 아무도
-- 모르는 채 쌓인다. 지우려면 어디 있는지 알아야 한다.
--
-- 적용: node scripts/d1Migrate.mjs migrations/0041_gallery_photo_original.sql

ALTER TABLE gallery_photos ADD COLUMN original_key TEXT;

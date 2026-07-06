-- Migration: 뉴스·미디어 게시물 (news_posts)
-- Target DB: Cloudflare D1 (SQLite)
-- Description:
--   공개 /media 페이지(뉴스 & 미디어)의 게시물 저장소.
--   - category: 'news'(소식) | 'press'(언론 보도) | 'video'(영상)
--   - title/body: 한/영 병렬 컬럼(_ko 필수, _en 선택 — events 테이블과 동일 규칙)
--   - source_name/external_url: 언론 보도의 출처·원문 링크
--   - youtube_url: 영상 게시물의 YouTube 링크(상세에서 임베드)
--   - thumbnail_*: 대표 이미지(R2). 영상은 없으면 YouTube 썸네일로 폴백
--   - published_at: 게시일('YYYY-MM-DD', 목록 정렬 기준). is_published=1일 때만 공개 노출
--   - created_by: 작성자 표시명(MySQL users와 교차 저장소라 FK 없이 문자열 보관)
-- Apply: npm run d1:migrate migrations/0024_news.sql

CREATE TABLE IF NOT EXISTS news_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT 'news',
  title_ko TEXT NOT NULL,
  title_en TEXT,
  body_ko TEXT,
  body_en TEXT,
  source_name TEXT,
  external_url TEXT,
  youtube_url TEXT,
  thumbnail_url TEXT,
  thumbnail_r2_key TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_news_posts_pub ON news_posts (is_published, published_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_news_posts_category ON news_posts (category);

-- 공개 /media 페이지 i18n 문구 (ko/en). locale/*.json 기본값과 동일하게 유지.
-- 기존 '준비 중' 문구가 D1 오버라이드로 남아있을 수 있어 반드시 upsert로 갱신한다.
INSERT INTO locale_content (keycode, ko, en) VALUES ('header.media', '미디어', 'Media')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.media.eyebrow', 'News & Media', 'News & Media')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.media.title', '뉴스 & 미디어', 'News & Media')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.media.subtitle', '춤누리의 새로운 소식', 'The latest from Choomnoori')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('pages.media.description', '공연 소식과 언론 보도, 영상 자료를 한곳에 모았습니다. 춤누리의 최신 활동을 확인해 보세요.', 'Performance news, press coverage, and videos in one place. Stay up to date with Choomnoori''s latest activities.')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('media.filter.all', '전체', 'All')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('media.filter.news', '소식', 'News')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('media.filter.press', '언론 보도', 'Press')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('media.filter.video', '영상', 'Video')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('media.card.readMore', '자세히 보기', 'Read More')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('media.empty', '아직 등록된 소식이 없습니다.', 'No posts yet.')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('media.loadMore', '더 보기', 'Load More')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('media.detail.back', '목록으로', 'Back to List')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('media.detail.source', '출처', 'Source')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('media.detail.externalLink', '기사 원문 보기', 'Read Original Article')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');
INSERT INTO locale_content (keycode, ko, en) VALUES ('media.detail.watchOnYoutube', 'YouTube에서 보기', 'Watch on YouTube')
  ON CONFLICT(keycode) DO UPDATE SET ko=excluded.ko, en=excluded.en, updated_at=datetime('now');

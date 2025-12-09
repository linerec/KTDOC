-- Migration: Create locale_content table
-- Description: Stores multilingual content for IntlObject system

-- Create locale_content table
CREATE TABLE IF NOT EXISTS locale_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keycode TEXT NOT NULL UNIQUE,
  ko TEXT,
  en TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Create index for faster keycode lookups
CREATE INDEX IF NOT EXISTS idx_locale_keycode ON locale_content(keycode);

-- Insert initial data from existing JSON files
INSERT INTO locale_content (keycode, ko, en) VALUES
  -- Common
  ('common.ok', '확인', 'OK'),
  ('common.cancel', '취소', 'Cancel'),
  ('common.save', '저장', 'Save'),
  ('common.edit', '편집', 'Edit'),
  ('common.delete', '삭제', 'Delete'),
  ('common.close', '닫기', 'Close'),
  ('common.loading', '로딩 중...', 'Loading...'),

  -- Header
  ('header.title', 'KTDOC', 'KTDOC'),
  ('header.home', '홈', 'Home'),
  ('header.about', '소개', 'About'),
  ('header.classes', '수업 및 프로그램', 'Classes & Programs'),
  ('header.performances', '공연', 'Performances'),
  ('header.gallery', '갤러리', 'Gallery'),

  -- Hero
  ('hero.subtitle', '한국 전통 춤의 아름다움', 'The Beauty of Korean Traditional Dance'),
  ('hero.title', '춤누리', 'Choomnoori'),
  ('hero.description', '한국 전통 무용의 아름다움을 전합니다.', 'Sharing the beauty of Korean traditional dance.'),
  ('hero.since', 'Since 1990', 'Since 1990'),
  ('hero.youtube', 'YouTube 채널 방문', 'Visit YouTube Channel'),

  -- Categories
  ('categories.traditional', '전통무용', 'Traditional Dance'),
  ('categories.creative', '창작무용', 'Creative Dance'),
  ('categories.education', '무용교육', 'Dance Education'),
  ('categories.performance', '공연활동', 'Performances'),

  -- Footer
  ('footer.copyright', 'All rights reserved.', 'All rights reserved.'),

  -- Auth
  ('auth.login', '로그인', 'Login'),
  ('auth.logout', '로그아웃', 'Logout'),
  ('auth.register', '회원가입', 'Register'),
  ('auth.email', '이메일', 'Email'),
  ('auth.password', '비밀번호', 'Password'),
  ('auth.name', '이름', 'Name'),

  -- IntlObject Edit Modal
  ('intl.edit.title', '번역 편집', 'Edit Translation'),
  ('intl.edit.keycode', '키코드', 'Keycode'),
  ('intl.edit.korean', '한국어', 'Korean'),
  ('intl.edit.english', '영어', 'English');

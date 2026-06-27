-- Migration: 관리 콘솔 메뉴 × 역할 권한(RBAC) 매트릭스
-- Target DB: MySQL (lib/db.ts). ※ 0001~0006은 Cloudflare D1(SQLite)용, 0007·0008만 MySQL 대상.
-- Description:
--   메뉴 "존재"의 진실의 원천(SSOT)은 코드 레지스트리(lib/admin/menu-registry.ts).
--   이 테이블은 관리자가 토글하는 "권한"의 SSOT — menu_key × role 별 허용 여부.
--   menu_key 에는 의도적으로 FK를 걸지 않는다(레지스트리가 코드에 있어 고아 키 허용·메뉴 삭제 안전).
--   menu_key 콜레이션은 utf8mb4_bin(대소문자 구분 → 'members'/'Members' PK 충돌 방지).

CREATE TABLE IF NOT EXISTS menu_permissions (
  menu_key   varchar(64) COLLATE utf8mb4_bin NOT NULL,
  role       enum('user','student','parent','teacher','admin')
             COLLATE utf8mb4_unicode_ci NOT NULL,        -- types/members.ts의 MEMBER_ROLES와 동기
  allowed    tinyint(1)  NOT NULL DEFAULT 0,
  updated_by varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  updated_at datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (menu_key, role),
  KEY idx_mp_role (role),
  CONSTRAINT fk_mp_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 기존 8개 메뉴 기본값 시드 = 현행 동작 정확 보존(회귀 0).
--   home/members/profile = 운영진(teacher+admin), 그 외 = admin 전용.
--   admin 행은 항상 1(런타임은 admin을 무조건 단락 허용하지만 표시·일관성 위해 명시).
INSERT INTO menu_permissions (menu_key, role, allowed) VALUES
 ('home','user',0),('home','student',0),('home','parent',0),('home','teacher',1),('home','admin',1),
 ('programs','user',0),('programs','student',0),('programs','parent',0),('programs','teacher',0),('programs','admin',1),
 ('applications','user',0),('applications','student',0),('applications','parent',0),('applications','teacher',0),('applications','admin',1),
 ('gallery','user',0),('gallery','student',0),('gallery','parent',0),('gallery','teacher',0),('gallery','admin',1),
 ('gallery.photos','user',0),('gallery.photos','student',0),('gallery.photos','parent',0),('gallery.photos','teacher',0),('gallery.photos','admin',1),
 ('gallery.categories','user',0),('gallery.categories','student',0),('gallery.categories','parent',0),('gallery.categories','teacher',0),('gallery.categories','admin',1),
 ('members','user',0),('members','student',0),('members','parent',0),('members','teacher',1),('members','admin',1),
 ('profile','user',0),('profile','student',0),('profile','parent',0),('profile','teacher',1),('profile','admin',1)
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);
-- settings.permissions(권한 관리 툴)은 DB에 넣지 않는다 — 코드에서 requireRole:'admin', fixed:true 로 하드코딩.

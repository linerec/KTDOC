-- Migration: 선생님(teacher)에게 '수업·프로그램' 메뉴 접근 허용
-- Target DB: MySQL (lib/db.ts). ※ 0007·0008·0019만 MySQL, 나머지는 Cloudflare D1 대상.
-- Description:
--   0008 시드는 programs를 admin 전용(teacher=0)으로 넣었다. 이제 수업·프로그램 관리와
--   수강생 배정을 운영진(선생님+관리자)이 함께 하도록 teacher를 허용으로 전환한다.
--   메뉴 "존재"의 SSOT는 코드 레지스트리(lib/admin/menu-registry.ts)이며, 이 행은 권한 "값"의 SSOT다.
--   원생·학부모용 'my-classes'(내 수업)는 DB 행 없이 레지스트리 defaultRoles로 동작하므로 여기 넣지 않는다.
-- Apply: 원격 MySQL에 적용(0008과 동일 경로).

INSERT INTO menu_permissions (menu_key, role, allowed) VALUES
  ('programs','teacher',1)
ON DUPLICATE KEY UPDATE allowed = VALUES(allowed);

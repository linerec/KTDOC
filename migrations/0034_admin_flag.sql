-- Migration: 신분(role)과 관리 권한(is_admin)을 분리한다
-- Target DB: MySQL (lib/db.ts). ※ 0007·0008·0019·0034가 MySQL, 나머지는 Cloudflare D1 대상.
-- Description:
--   지금까지 role 한 칸에 신분과 권한이 함께 들어 있었다. 그래서 선생님에게 관리
--   업무를 맡기려면 role을 'admin'으로 바꿔야 했고, 그 순간 그 사람은 선생님이기를
--   그만뒀다 — 담당 수업·수업 배정 같은 선생님 기능이 통째로 사라졌다.
--
--   신분은 role에, 관리 권한은 is_admin 플래그에 나눠 담는다. 이제 "선생님이면서
--   관리자", "원생이면서 관리자"가 성립하고, 권한만 붙였다 뗐다 할 수 있다.
--
--   enum의 'admin'은 지우지 않는다. 이관 뒤 그 값을 쓰는 행은 0개가 되지만,
--   남겨 두어야 문제가 생겼을 때 UPDATE 한 줄로 되돌릴 수 있다.
-- Apply: 원격 MySQL에 적용(0007·0008과 동일 경로).

-- 1) 신분에 'staff'(배우지도 가르치지도 않는 운영 계정)를 더하고, 권한 칸을 세운다.
ALTER TABLE users
  MODIFY COLUMN role enum('user','student','parent','teacher','staff','admin')
    COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  ADD COLUMN is_admin tinyint(1) NOT NULL DEFAULT 0 AFTER role;

-- 2) 권한을 먼저 옮긴다. 이 줄이 끝나기 전에는 아무도 관리 권한을 잃지 않는다.
UPDATE users SET is_admin = 1 WHERE role = 'admin';

-- 3) 그 다음 신분을 돌려준다.
--    입학년도가 있는 사람은 학원 구성원이다(한진선·2017, Soo Gyung Baek·2022,
--    Jean Choi·2014 — 관리 업무를 맡기려고 최근에 admin이 된 선생님들).
--    입학년도가 없는 계정은 학원 공용(choomnoori@)과 개발자(owenkdev@)로, 배우지도
--    가르치지도 않으므로 'staff'다.
UPDATE users SET role = 'teacher'
  WHERE role = 'admin' AND enrollment_year IS NOT NULL;
UPDATE users SET role = 'staff'
  WHERE role = 'admin' AND enrollment_year IS NULL;

-- 4) 권한 매트릭스의 'admin' 행은 의미를 잃는다(플래그가 무조건 통과시키므로).
--    지우지 않고 남긴다 — 롤백하면 그대로 다시 쓰인다. 화면에서는 MEMBER_ROLES에
--    'admin'이 없으므로 열로 나오지 않는다.
--    'staff' 신분 자체에는 아무 메뉴도 주지 않는다. 관리 권한이 붙어야 의미가 있는
--    계정이고, 권한이 없는 staff는 볼 것이 없는 게 맞다(레지스트리 폴백 = 없음).

-- 되돌리려면:
--   UPDATE users SET role = 'admin' WHERE is_admin = 1;
--   ALTER TABLE users DROP COLUMN is_admin;

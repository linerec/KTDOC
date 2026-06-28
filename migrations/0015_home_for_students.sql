-- 0015_home_for_students.sql (MySQL)
-- 원생·학부모가 /admin 대시보드(home)에 착지해 알림 온보딩을 보도록,
-- menu_permissions 에 남아있는 home 메뉴의 명시적 차단 행(student·parent)을 제거한다.
-- 제거하면 레지스트리 defaultRoles(student·parent·teacher·admin)가 적용되어 허용된다.
-- (teacher·admin 행과 legacy 'user' 차단 행은 그대로 둔다.)

DELETE FROM menu_permissions WHERE menu_key = 'home' AND role IN ('student', 'parent');

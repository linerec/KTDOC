-- Migration: 알림 발송 대상에 '수업'을 더한다
-- Target DB: MySQL (ktdoc). ※ 0007·0008·0019·0030·0031·0038 계열만 MySQL, 나머지는 D1.
-- Description:
--   지금까지 알림은 전체·역할별·개인 셋으로만 보낼 수 있었다. 그런데 학원에서
--   가장 자주 보내는 것은 "이번 주 유년부 난타 휴강"처럼 **한 수업의 수강생과
--   보호자에게만** 가는 공지다. 그 대상이 없어서 카톡으로 나가고 있었고,
--   그러면 누구에게 무엇이 언제 나갔는지 시스템에 남지 않는다.
--
--   target_value 에는 programs.id(D1)를 문자열로 담는다. 저장소가 달라 FK는 없다
--   (event_checkins·program_enrollments 와 같은 교차 저장소 관례).
-- Apply: npm run mysql:migrate migrations/0039_notify_class_target.sql

ALTER TABLE notifications
  MODIFY COLUMN target_type ENUM('all','role','user','class') NOT NULL;

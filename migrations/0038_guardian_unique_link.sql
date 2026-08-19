-- Migration: 학부모↔원생 확정 연결의 중복을 DB가 막는다
-- Target DB: MySQL (lib/db.ts). ※ 0007·0008·0019·0023·0034가 MySQL, 나머지는 Cloudflare D1 대상.
-- Description:
--   student_guardians에 (guardian_id, student_id) 유니크가 없어 같은 자녀의
--   확정 연결이 두 행 생길 수 있다 — 셀프 신청과 운영진 확정이 경쟁하거나
--   더블클릭이 겹치면 애플리케이션의 SELECT-then-INSERT 검사가 뚫린다.
--   중복이 생기면 자녀가 목록에 두 번 나오고, 해제해도 한 행이 남는다.
--
--   student_id가 NULL인 미해결 신청은 유니크에 걸리지 않아야 하므로
--   (MySQL 유니크 인덱스는 NULL을 중복으로 치지 않는다) 그대로 둔다.
--
-- ⚠️ 적용 전 기존 중복 행을 먼저 접는다 — 중복이 있으면 ALTER가 실패한다.

-- 1) 기존 중복 확정 연결 정리: 같은 (guardian_id, student_id) 중 가장 오래된 행만 남긴다.
-- created_at은 초 단위라 동시 생성이면 같은 값일 수 있다 — id로 순서를 마저 가른다.
DELETE sg FROM student_guardians sg
JOIN student_guardians keep
  ON keep.guardian_id = sg.guardian_id
 AND keep.student_id = sg.student_id
 AND (keep.created_at < sg.created_at
      OR (keep.created_at = sg.created_at AND keep.id < sg.id))
WHERE sg.student_id IS NOT NULL;

-- 2) 확정 연결 유니크 (NULL student_id는 제외되어 미해결 신청은 여러 건 가능)
ALTER TABLE student_guardians
  ADD UNIQUE KEY uq_sg_guardian_student (guardian_id, student_id);

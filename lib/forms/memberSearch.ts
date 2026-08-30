/**
 * 신청서에서 고를 수 있는 회원 찾기 — 이름·이메일로 찾는다 (서버 전용)
 *
 * 두 화면이 같은 집합을 봐야 한다. 상세에서 "연결"할 때 나오는 회원과 대리 입력에서
 * "이 사람의 신청"으로 고르는 회원이 다르면, 운영진은 둘 중 어느 쪽을 믿어야 할지
 * 알 수 없다. 그래서 조회를 여기 한 곳에 두고 두 라우트가 같이 쓴다.
 *
 * **이메일이 같다는 것만으로 자동 연결하지 않는다.** 이 사이트는 가입 시 이메일을
 * 확인하지 않으므로 동일 이메일이 동일인의 증거가 되지 못한다 — 운영진이 눈으로
 * 보고 고르고, link_source='manual' 이 그 사실을 남긴다.
 *
 * 타입·상수는 types/members.ts 에 있다. 이 파일은 mysql 을 끌고 오므로
 * 클라이언트 컴포넌트가 import 하면 번들이 깨진다.
 */

import { getMembers } from '@/lib/members';
import { MEMBER_SEARCH_MIN, type LinkableMember } from '@/types/members';

export async function searchLinkableMembers(q: string): Promise<LinkableMember[]> {
  const term = q.trim();
  if (term.length < MEMBER_SEARCH_MIN) return [];

  const { members } = await getMembers({ search: term, limit: 20 });
  return members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone,
    role: m.role,
    status: m.status,
    children: (m.children ?? [])
      .filter((c) => c.studentId && c.studentName)
      .map((c) => ({ id: c.studentId as string, name: c.studentName as string })),
  }));
}

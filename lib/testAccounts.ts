/**
 * 테스트(샘플) 계정 — 각 역할(원생·선생님·학부모)의 관리 콘솔을 상시 점검하기 위한 고정 계정.
 *
 * - 데이터 단일 출처는 testAccounts.json 이며, 회원 관리 화면(게시 패널)과
 *   시드 스크립트(scripts/seedTestAccounts.mjs)가 같은 파일을 공유한다.
 * - 비밀번호는 의도적으로 평문 공개된다(회원 관리 화면에 게시). 실제 회원 데이터가 아닌
 *   점검용 계정이므로 분실 방지를 위해 노출한다.
 * - 계정 생성/리셋: `npm run seed:test`
 */
import type { MemberRole } from '@/types/members';
import accounts from './testAccounts.json';

export interface TestAccount {
  role: MemberRole;
  email: string;
  password: string;
  name: string;
  /** 원생: 입학년도 */
  enrollmentYear?: number;
  /** 학부모: 연결할 자녀(원생) 이름 */
  childName?: string;
  /** 학부모: 연결할 자녀(원생) 입학년도 */
  childEnrollmentYear?: number;
}

export const TEST_ACCOUNTS = accounts as unknown as TestAccount[];

/** 테스트 계정 이메일 집합 (회원 목록에서 배지 표시 등에 활용 가능) */
export const TEST_ACCOUNT_EMAILS = new Set(TEST_ACCOUNTS.map((a) => a.email));

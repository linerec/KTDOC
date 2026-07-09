import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * 운영진 발급용 임시 비밀번호 생성 — 숫자 8자리.
 * 대상 사용자(고령 학부모 등)가 전화로 전달받아 그대로 입력하기 쉽도록
 * 문자 없이 숫자만 쓴다. 로그인 즉시 새 비밀번호 설정이 강제되므로
 * 엔트로피보다 전달 가능성을 우선한다.
 */
export function generateTempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(8));
  return Array.from(bytes, (n) => String(n % 10)).join('');
}

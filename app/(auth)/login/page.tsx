import type { Metadata } from 'next';
import LoginForm from '@/components/auth/LoginForm';
import { getSetting } from '@/lib/d1';
import { SETTING_SEO_BUSINESS, parseSeoBusiness } from '@/lib/seoBusiness';

export const metadata: Metadata = {
  title: '로그인 - KTDOC',
  description: 'KTDOC 계정에 로그인하세요.',
};

export default async function LoginPage() {
  // 비밀번호 분실 안내의 전화 연결 — SEO 패널 연락처(D1)를 단일 소스로 재사용.
  // D1 장애 시에도 로그인 자체는 막히지 않도록 빈 값으로 폴백한다.
  let contactTel = '';
  try {
    contactTel = parseSeoBusiness(await getSetting(SETTING_SEO_BUSINESS)).telephone;
  } catch {
    contactTel = '';
  }

  return <LoginForm contactTel={contactTel} />;
}

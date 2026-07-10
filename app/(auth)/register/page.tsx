import type { Metadata } from 'next';
import RegisterForm from '@/components/auth/RegisterForm';
import { getSetting } from '@/lib/d1';
import { SETTING_SEO_BUSINESS, parseSeoBusiness } from '@/lib/seoBusiness';

export const metadata: Metadata = {
  title: '회원가입 - KTDOC',
  description: 'KTDOC에 새로운 계정을 만드세요.',
};

export default async function RegisterPage() {
  // 승인 대기 안내의 전화 연결 — SEO 패널 연락처(D1)를 단일 소스로 재사용.
  // D1 장애 시에도 가입 자체는 막히지 않도록 빈 값으로 폴백한다.
  let contactTel = '';
  try {
    contactTel = parseSeoBusiness(await getSetting(SETTING_SEO_BUSINESS)).telephone;
  } catch {
    contactTel = '';
  }

  return <RegisterForm contactTel={contactTel} />;
}

import type { Metadata } from 'next';
import RegisterForm from '@/components/auth/RegisterForm';

export const metadata: Metadata = {
  title: '회원가입 - KTDOC',
  description: 'KTDOC에 새로운 계정을 만드세요.',
};

export default function RegisterPage() {
  return <RegisterForm />;
}

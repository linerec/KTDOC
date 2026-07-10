import type { Metadata } from 'next';
import LoginForm from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: '로그인 - KTDOC',
  description: 'KTDOC 계정에 로그인하세요.',
};

export default function LoginPage() {
  return <LoginForm />;
}

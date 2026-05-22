import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-container">
      <div className="auth-header">
        <Link href="/">
          <Image
            src="/assets/logo/logo_white.png"
            alt="KTDOC Logo"
            width={120}
            height={42}
            style={{ height: '50px', width: 'auto' }}
            priority
          />
        </Link>
      </div>
      <div className="auth-content">{children}</div>
    </div>
  );
}

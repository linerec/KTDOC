/**
 * Admin — 자료함 상세
 *
 * 번호와 QR이 맨 위에 있다. 운영진이 이 화면을 여는 첫 번째 이유가 그것이기
 * 때문이다(현장에 무엇을 들려 보낼지).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import T from '@/components/common/T';
import VaultDetail from '@/components/admin/resources/VaultDetail';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getVaultById, listAccessLog, listItems } from '@/lib/d1/resources';
import { decryptPasscode } from '@/lib/resources/passcode';

export const metadata: Metadata = {
  title: '자료함 | KTDOC Admin',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminResourceDetailPage({ params }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'resources');

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const vault = await getVaultById(id);
  if (!vault) notFound();

  const [items, log] = await Promise.all([listItems(id), listAccessLog(id, 100)]);

  // 복호는 서버에서 한 번만. 실패(AUTH_SECRET이 바뀐 배포)면 null이 내려가고
  // 화면이 "다시 설정해 주세요"로 드러낸다 — 조용히 통과시키지 않는다.
  const passcode = decryptPasscode(vault.passcodeEnc, process.env.AUTH_SECRET ?? '');

  // passcodeEnc는 클라이언트 경계를 넘지 않는다
  const { passcodeEnc: _omit, ...safeVault } = vault;
  void _omit;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <Link href="/admin/resources">
              <T k="admin.resources.crumb">공연 자료함</T>
            </Link>
          </div>
          <h1 className="admin-title">{vault.title}</h1>
        </div>
      </div>

      <VaultDetail vault={safeVault} items={items} log={log} passcode={passcode} />
    </div>
  );
}

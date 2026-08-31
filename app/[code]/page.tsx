/**
 * 공연 자료함 공개 진입 — ktdoc.org/473128
 *
 * 루트에 동적 세그먼트를 두지만 걱정할 일은 없다: Next.js는 정적 경로를 항상
 * 먼저 맞추고, 여기서는 여섯 자리 숫자가 아니면 곧바로 notFound()로 넘긴다.
 * /about·/gallery는 물론 오타 주소도 지금과 똑같이 동작한다.
 *
 * 잠긴 화면에는 **제목조차 내려보내지 않는다.** 번호만 우연히 맞춘 사람에게
 * "여기 뭐가 있다"를 알릴 이유가 없다.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ResourceLockScreen from '@/components/resources/ResourceLockScreen';
import ResourceVaultView from '@/components/resources/ResourceVaultView';
import { listItems } from '@/lib/d1/resources';
import { isValidResourceCode } from '@/lib/resources/code';
import { resolvePublicGate } from '@/lib/resources/publicGate';
import { toPublicItem } from '@/types/resources';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '공연 자료함',
  // 번호가 검색에 걸릴 이유가 없다
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ k?: string }>;
}

export default async function ResourceCodePage({ params, searchParams }: PageProps) {
  const { code } = await params;
  if (!isValidResourceCode(code)) notFound();

  const { k } = await searchParams;
  const { vault, verdict } = await resolvePublicGate({ code, need: 'view', linkToken: k ?? null });

  if (!vault) notFound();

  if (!verdict.ok) {
    if (verdict.reason === 'not_found') notFound();

    // 꺼졌거나 기간이 지난 자료함은 키패드를 띄우지 않는다 —
    // 맞는 비밀번호를 쳐도 안 열리는 화면은 사람을 붙잡아 둘 뿐이다.
    if (verdict.reason === 'inactive' || verdict.reason === 'expired') {
      return (
        <main className="rv-page rv-page--center">
          <div className="rv-closed">
            <p className="rv-closed__mark" aria-hidden="true">
              ⌧
            </p>
            <h1 className="rv-closed__title">지금은 열 수 없는 자료함입니다</h1>
            <p className="rv-closed__hint">담당 선생님께 문의해 주세요.</p>
          </div>
        </main>
      );
    }
    return (
      <main className="rv-page rv-page--center">
        <ResourceLockScreen code={code} />
      </main>
    );
  }

  const items = await listItems(vault.id);

  return (
    <main className="rv-page">
      <ResourceVaultView
        code={code}
        title={vault.title}
        note={vault.note}
        allowDownload={vault.allowDownload}
        allowEmail={vault.allowEmail}
        items={items.map(toPublicItem)}
      />
    </main>
  );
}

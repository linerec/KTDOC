/**
 * ArchiveBridge
 * 공연 쇼케이스 → 연도별 갤러리 아카이브로 연결하는 브리지 밴드.
 */

import Link from 'next/link';
import IntlObject from '@/components/common/IntlObject';

export default function ArchiveBridge() {
  return (
    <section className="performance-bridge">
      <div className="container">
        <span className="dancheong-divider" aria-hidden="true" />
        <h2 className="performance-bridge-title">
          <IntlObject keycode="pages.performances.bridgeTitle" />
        </h2>
        <p className="performance-bridge-body">
          <IntlObject keycode="pages.performances.bridgeBody" />
        </p>
        <Link href="/gallery" className="btn-ink-ghost">
          <IntlObject keycode="pages.performances.viewArchiveCta" />
        </Link>
      </div>
    </section>
  );
}

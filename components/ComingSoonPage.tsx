'use client';

import Link from 'next/link';
import IntlObject from '@/components/common/IntlObject';

interface ComingSoonPageProps {
  section: 'classes' | 'performances' | 'community' | 'media';
  featureCount?: number;
  primaryHref?: string;
}

export default function ComingSoonPage({
  section,
  featureCount = 3,
  primaryHref = '/gallery',
}: ComingSoonPageProps) {
  const isExternalPrimary = primaryHref.startsWith('http');
  const features = Array.from({ length: featureCount }, (_, index) => index + 1);

  return (
    <>
      <section className={`feature-hero feature-hero-${section}`}>
        <div className="container">
          <div className="feature-hero-copy">
            <p className="feature-eyebrow">
              <IntlObject keycode={`pages.${section}.eyebrow`} />
            </p>
            <IntlObject
              keycode={`pages.${section}.title`}
              returnType="h1"
              className="feature-title"
            />
            <IntlObject
              keycode={`pages.${section}.description`}
              returnType="p"
              className="feature-description"
            />
            <div className="feature-actions">
              <Link
                href={primaryHref}
                className="feature-action feature-action-primary"
                target={isExternalPrimary ? '_blank' : undefined}
                rel={isExternalPrimary ? 'noopener noreferrer' : undefined}
              >
                <IntlObject keycode={`pages.${section}.primaryCta`} />
              </Link>
              <Link href="/gallery" className="feature-action feature-action-secondary">
                <IntlObject keycode="pages.shared.galleryCta" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="feature-preview-section">
        <div className="container">
          <div className="feature-preview-grid">
            {features.map((featureNumber) => (
              <article className="feature-preview-card" key={featureNumber}>
                <p className="feature-preview-index">{String(featureNumber).padStart(2, '0')}</p>
                <IntlObject
                  keycode={`pages.${section}.feature${featureNumber}`}
                  returnType="p"
                  className="feature-preview-body"
                />
              </article>
            ))}
          </div>
          <div className="feature-status-panel">
            <IntlObject
              keycode={`pages.${section}.status`}
              returnType="p"
              className="feature-status-text"
            />
          </div>
        </div>
      </section>
    </>
  );
}

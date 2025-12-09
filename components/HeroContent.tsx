'use client';

import Link from 'next/link';
import IntlObject from '@/components/common/IntlObject';
import ImageObject from '@/components/common/ImageObject';

export function HeroLogo() {
    return (
        <div className="hero-logo-section">
            <ImageObject
                keycode="image.hero.logo"
                width={600}
                height={180}
                className="hero-logo-image"
                fallbackSrc="/assets/logo/logo_long.png"
                priority
            />
        </div>
    );
}

export function HeroText() {
    return (
        <div className="hero-left">
            <div className="hero-title-wrapper">
                <h1 className="hero-title">
                    <IntlObject keycode="hero.title.grace" returnType="span" />
                    <IntlObject keycode="hero.title.rhythm" returnType="span" />
                    <IntlObject keycode="hero.title.tradition" returnType="span" />
                </h1>
            </div>

            <p className="hero-since">
                <IntlObject keycode="hero.since" />
            </p>

            <Link
                href="https://www.youtube.com/@ktdoc1737"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-youtube"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path d="M8 5v14l11-7z" />
                </svg>
                <IntlObject keycode="hero.youtube.btn" />
            </Link>
        </div>
    );
}

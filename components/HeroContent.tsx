'use client';

import Link from 'next/link';
import IntlObject from '@/components/common/IntlObject';

export function HeroText() {
    return (
        <div className="hero-left">
            <div className="hero-title-wrapper">
                <p className="hero-kicker">
                    <IntlObject keycode="hero.kicker" />
                </p>
                <h1 className="hero-title">
                    <span className="hero-title-line">
                        <IntlObject keycode="hero.headline.line1" returnType="span" />
                    </span>
                    <span className="hero-title-line hero-title-line2">
                        <IntlObject keycode="hero.headline.line2a" returnType="span" />
                        <span className="hero-title-gap"> </span>
                        <IntlObject keycode="hero.headline.line2b" returnType="span" />
                    </span>
                </h1>
                <p className="hero-lede">
                    <IntlObject keycode="hero.headline.secondary" />
                </p>
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

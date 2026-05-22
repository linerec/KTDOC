'use client';

import Image from 'next/image';
import Link from 'next/link';
import IntlObject from '@/components/common/IntlObject';
import ImageObject from '@/components/common/ImageObject';

export default function Footer() {
    return (
        <footer id="main-footer">
            <div className="container">
                <div className="footer-top">
                    <div className="footer-logo">
                        <ImageObject
                            keycode="image.footer.logo"
                            width={160}
                            height={40}
                            className="footer-logo-img"
                            fallbackSrc="/assets/logo/logo_white.png"
                        />
                    </div>
                    <div className="social-links">
                        <Link href="https://www.instagram.com/ktdoc_choomnoori/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                            <Image
                                src="/assets/images/icon-instagram.png"
                                alt="Instagram"
                                width={32}
                                height={32}
                                className="social-icon-color"
                            />
                        </Link>
                        <Link href="https://www.youtube.com/@ktdoc1737" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                            <Image
                                src="/assets/images/youtube-icon.png"
                                alt="YouTube"
                                width={32}
                                height={32}
                                className="social-icon-color"
                            />
                        </Link>
                    </div>
                </div>
                <div className="footer-bottom">
                    <div className="footer-copy">
                        <IntlObject keycode="footer.tagline" returnType="p" />
                        <IntlObject keycode="footer.contact" returnType="p" className="footer-contact" />
                    </div>
                    <p><IntlObject keycode="footer.copyright" /></p>
                </div>
            </div>
        </footer>
    );
}

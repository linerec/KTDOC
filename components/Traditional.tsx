'use client';

import Image from 'next/image';
import IntlObject from '@/components/common/IntlObject';

export default function Traditional() {
    return (
        <section id="traditional">
            <div className="traditional-container">
                {/* Vertical Text */}
                <div className="traditional-vertical-text">
                    <IntlObject keycode="traditional.vertical.text" />
                </div>

                {/* Dancheong Roof Image */}
                <div className="traditional-dancheong">
                    <Image
                        src="/assets/images/dancheong.png"
                        alt="Traditional Korean Roof - Dancheong"
                        width={1200}
                        height={600}
                        className="dancheong-image"
                        priority
                    />
                </div>
            </div>
        </section>
    );
}

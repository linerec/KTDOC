'use client';

import IntlObject from '@/components/common/IntlObject';
import ImageObject from '@/components/common/ImageObject';

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
                    <ImageObject
                        keycode="image.traditional.dancheong"
                        width={1200}
                        height={600}
                        className="dancheong-image"
                        containerClassName="traditional-dancheong-fill"
                        fallbackSrc="/assets/images/dancheong.png"
                        alt="Traditional Korean Roof - Dancheong"
                        priority
                    />
                </div>
            </div>
        </section>
    );
}

'use client';

import IntlObject from '@/components/common/IntlObject';
import ImageObject from '@/components/common/ImageObject';

export default function Traditional() {
    return (
        <section id="traditional">
            {/* 처마 뒤 하늘 — 수묵이 번지는 루프. 두 테마에서 같은 소스를 쓰되
                블렌드가 뒤집힌다(다크 screen / 라이트 invert+multiply). 장식이라
                aria-hidden. */}
            <div className="traditional-sky" aria-hidden="true">
                <video
                    className="traditional-sky-video"
                    poster="/assets/video/traditional-sky.jpg"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                >
                    {/* webm이 같은 화질에서 더 작다 — 지원하는 브라우저는 이쪽을 집는다 */}
                    <source src="/assets/video/traditional-sky.webm" type="video/webm" />
                    <source src="/assets/video/traditional-sky.mp4" type="video/mp4" />
                </video>
            </div>

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

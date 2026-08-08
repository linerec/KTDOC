'use client';

import IntlObject from '@/components/common/IntlObject';
import ImageObject from '@/components/common/ImageObject';

export default function Mission() {
    return (
        <section id="mission" className="mission-section" aria-labelledby="mission-title">
            {/* 한삼 자락이 그리는 궤적 — 춤의 선이 곧 붓의 획이라는 자리.
                예전 정적 배경(black_stroke.png)을 대신한다. 두 테마에서 같은
                소스를 쓰되 블렌드가 뒤집힌다. 장식이라 aria-hidden. */}
            <div className="mission-sky" aria-hidden="true">
                <video
                    className="mission-sky-video"
                    poster="/assets/video/mission-hansam.jpg"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="metadata"
                >
                    <source src="/assets/video/mission-hansam.webm" type="video/webm" />
                    <source src="/assets/video/mission-hansam.mp4" type="video/mp4" />
                </video>
            </div>

            <div className="mission-shell">
                <div className="mission-media" aria-hidden="true">
                    <ImageObject
                        keycode="image.mission.photo"
                        fill
                        sizes="(max-width: 900px) 100vw, 42vw"
                        className="mission-image"
                        containerClassName="mission-media-fill"
                        fallbackSrc="/assets/images/site/sogo-stage.jpg"
                        imageStyle={{ objectFit: 'contain', objectPosition: 'center' }}
                    />
                </div>

                <div className="mission-copy">
                    <p className="mission-eyebrow">
                        <IntlObject keycode="mission.eyebrow" />
                    </p>
                    <h2 id="mission-title" className="mission-title">
                        <IntlObject keycode="mission.quote" />
                    </h2>
                    <div className="mission-body">
                        <IntlObject keycode="mission.body1" returnType="p" />
                        <IntlObject keycode="mission.body2" returnType="p" />
                        <IntlObject keycode="mission.body3" returnType="p" />
                        <IntlObject keycode="mission.body4" returnType="p" />
                        <IntlObject keycode="mission.body5" returnType="p" />
                    </div>
                </div>
            </div>
        </section>
    );
}

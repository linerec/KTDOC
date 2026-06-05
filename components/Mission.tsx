'use client';

import IntlObject from '@/components/common/IntlObject';
import ImageObject from '@/components/common/ImageObject';

export default function Mission() {
    return (
        <section id="mission" className="mission-section" aria-labelledby="mission-title">
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

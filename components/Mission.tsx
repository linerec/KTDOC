'use client';

import Image from 'next/image';
import IntlObject from '@/components/common/IntlObject';

export default function Mission() {
    return (
        <section id="mission" className="mission-section" aria-labelledby="mission-title">
            <div className="mission-shell">
                <div className="mission-media" aria-hidden="true">
                    <Image
                        src="/assets/images/about01.jpg"
                        alt=""
                        fill
                        sizes="(max-width: 900px) 100vw, 42vw"
                        className="mission-image"
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

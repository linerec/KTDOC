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

            </div>

            {/* 산수(山水) — 안개 속으로 물러나는 산. 위의 수묵 하늘이 그대로 이어져
                하늘과 산이 한 폭의 산수화가 된다.
                흰 배경 위 먹 그림이라 블렌드로 배경을 날린다(하늘과 같은 방식).
                아주 느리게 숨쉬듯 움직여 안개가 흐르는 것처럼 보이게 한다. */}
            <div className="traditional-sansu" aria-hidden="true">
                <ImageObject
                    keycode="image.traditional.sansu"
                    width={1568}
                    height={672}
                    className="sansu-image"
                    containerClassName="traditional-sansu-fill"
                    fallbackSrc="/assets/images/sansu.jpg"
                    alt=""
                    priority
                />
            </div>
        </section>
    );
}

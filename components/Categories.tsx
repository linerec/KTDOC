'use client';

import Link from 'next/link';
import ImageObject from '@/components/common/ImageObject';
import IntlObject from '@/components/common/IntlObject';

const categories = [
    {
        id: 'education',
        keycode: 'category.education',
        titleKeycode: 'categories.education',
        href: '/classes',
        fallbackSrc: '/assets/images/site/sogo-stage.jpg',
    },
    {
        id: 'performance',
        keycode: 'category.performance',
        titleKeycode: 'categories.performance',
        href: '/performances',
        fallbackSrc: '/assets/images/site/fan-dance-parade.jpg',
    },
    {
        id: 'timeline',
        keycode: 'category.timeline',
        titleKeycode: 'categories.timeline',
        href: '/timeline',
        // 공연 카드의 D1 관리 이미지(단체사진)와 겹치지 않도록 거리 퍼레이드 컷 사용
        fallbackSrc: '/assets/images/site/community-street.jpg',
    },
    {
        id: 'media',
        keycode: 'category.media',
        titleKeycode: 'categories.media',
        href: '/media',
        fallbackSrc: '/assets/images/site/times-square-drums.jpg',
    },
];

export default function Categories() {
    return (
        <section id="categories">
            <div className="container">
                <div className="categories-grid">
                {categories.map((category) => (
                    <Link href={category.href} key={category.id} className="category-card">
                        <ImageObject
                            keycode={category.keycode}
                            fill
                            sizes="(max-width: 768px) 100vw, 25vw"
                            className="category-bg-image"
                            containerClassName="category-image-container"
                            fallbackSrc={category.fallbackSrc}
                            overlay
                        >
                            <div className="category-content">
                                <IntlObject
                                    keycode={category.titleKeycode}
                                    returnType="h3"
                                    className="category-title"
                                />
                            </div>
                        </ImageObject>
                    </Link>
                ))}
                </div>
            </div>
        </section>
    );
}

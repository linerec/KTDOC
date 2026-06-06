'use client';

import Link from 'next/link';
import ImageObject from '@/components/common/ImageObject';
import IntlObject from '@/components/common/IntlObject';

const categories = [
    {
        id: 'performance',
        keycode: 'category.performance',
        titleKeycode: 'categories.performance',
        href: '/performances',
        fallbackSrc: '/assets/images/site/fan-dance-parade.jpg',
    },
    {
        id: 'education',
        keycode: 'category.education',
        titleKeycode: 'categories.education',
        href: '/classes',
        fallbackSrc: '/assets/images/site/sogo-stage.jpg',
    },
    {
        id: 'community',
        keycode: 'category.community',
        titleKeycode: 'categories.community',
        href: '/community',
        fallbackSrc: '/assets/images/site/group-portrait.jpg',
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

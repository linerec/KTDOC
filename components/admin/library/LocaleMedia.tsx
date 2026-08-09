'use client';

/**
 * 공개 페이지용 갤러리·영상 컴포넌트를 콘솔 언어에 맞춰 쓰는 얇은 껍데기
 *
 * ImageGallery / VideoList는 locale을 prop으로 받는다(공개 페이지가 경로에 따라 넘긴다).
 * 콘솔에는 그런 경로가 없고 사용자 선호(localStorage)만 있으므로, 여기서 그 값을 읽어
 * 넘긴다. 공개 컴포넌트 쪽은 손대지 않는다.
 */

import ImageGallery from '@/components/gallery/ImageGallery';
import { VideoList } from '@/components/gallery/VideoEmbed';
import { useLanguage } from '@/contexts/LanguageContext';

type ImageGalleryProps = Omit<React.ComponentProps<typeof ImageGallery>, 'locale'>;
type VideoListProps = Omit<React.ComponentProps<typeof VideoList>, 'locale'>;

export function LocaleImageGallery(props: ImageGalleryProps) {
  const { locale } = useLanguage();
  return <ImageGallery {...props} locale={locale} />;
}

export function LocaleVideoList(props: VideoListProps) {
  const { locale } = useLanguage();
  return <VideoList {...props} locale={locale} />;
}

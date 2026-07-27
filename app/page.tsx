import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Mission from '@/components/Mission';
import RecentJourney from '@/components/home/RecentJourney';
import Categories from '@/components/Categories';
import Traditional from '@/components/Traditional';
import Footer from '@/components/Footer';

/**
 * 홈은 ISR로 서빙한다. 기본값이면 Hero의 YouTube fetch(revalidate 3600)가
 * 페이지 전체를 1시간에 묶어, '최근 발자취'에 새 행사가 최대 1시간 늦게 뜬다
 * (운영자가 "공개했는데 홈에 안 보인다"고 오해하는 지점).
 * YouTube 응답은 fetch 레벨에서 계속 캐시되므로 여기서 5분으로 줄여도
 * 늘어나는 것은 D1 조회 한 번뿐이다.
 */
export const revalidate = 300;

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Mission />
        <RecentJourney />
        <Categories />
        <Traditional />
      </main>
      <Footer />
    </>
  );
}

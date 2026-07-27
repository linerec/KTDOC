import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Mission from '@/components/Mission';
import RecentJourney from '@/components/home/RecentJourney';
import Categories from '@/components/Categories';
import Traditional from '@/components/Traditional';
import Footer from '@/components/Footer';

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

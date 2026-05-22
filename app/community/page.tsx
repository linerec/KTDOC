import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ComingSoonPage from '@/components/ComingSoonPage';

export default function Community() {
  return (
    <>
      <Header />
      <main>
        <ComingSoonPage section="community" primaryHref="/gallery" />
      </main>
      <Footer />
    </>
  );
}

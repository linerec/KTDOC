import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ComingSoonPage from '@/components/ComingSoonPage';

export default function Performances() {
  return (
    <>
      <Header />
      <main>
        <ComingSoonPage section="performances" primaryHref="/gallery" />
      </main>
      <Footer />
    </>
  );
}

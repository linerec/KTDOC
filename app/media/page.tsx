import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ComingSoonPage from '@/components/ComingSoonPage';

export default function Media() {
  return (
    <>
      <Header />
      <main>
        <ComingSoonPage section="media" primaryHref="https://www.youtube.com/@ktdoc1737" />
      </main>
      <Footer />
    </>
  );
}

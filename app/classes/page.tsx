import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ComingSoonPage from '@/components/ComingSoonPage';

export default function Classes() {
  return (
    <>
      <Header />
      <main>
        <ComingSoonPage section="classes" primaryHref="/register" />
      </main>
      <Footer />
    </>
  );
}

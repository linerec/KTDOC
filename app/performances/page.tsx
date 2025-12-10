import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IntlObject from '@/components/common/IntlObject';

export default function Performances() {
  return (
    <>
      <Header />
      <main>
        <section className="page-hero">
          <div className="container">
            <IntlObject
              keycode="pages.performances.title"
              returnType="h1"
              className="page-title"
            />
            <IntlObject
              keycode="pages.performances.description"
              returnType="p"
              className="page-description"
            />
          </div>
        </section>

        <section className="page-content">
          <div className="container">
            <div className="coming-soon">
              <IntlObject
                keycode="common.comingSoon"
                returnType="p"
              />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

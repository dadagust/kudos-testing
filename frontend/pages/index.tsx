import Head from 'next/head';

import { CatalogueList } from '../src/app/(landing)/components/catalogue-list/CatalogueList';
import { HeroSection } from '../src/app/(landing)/components/hero-section/HeroSection';
import { NewArrivalsSection } from '../src/app/(landing)/components/new-arrivals-section/NewArrivalsSection';
import { FrontendFooter } from '../src/app/(landing)/components/footer/Footer';

export default function Home() {
  return (
    <>
      <Head>
        <title>KUDOS — аренда мебели и декора</title>
        <meta name="description" content="Аренда мебели и декора для мероприятий KUDOS" />
      </Head>
      <HeroSection />
      <NewArrivalsSection />
      <CatalogueList />
      <FrontendFooter />
    </>
  );
}

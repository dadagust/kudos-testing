import Head from 'next/head';

import { HeroSection } from '../src/app/(landing)/components/hero-section/HeroSection';

export default function Home() {
  return (
    <>
      <Head>
        <title>KUDOS — аренда мебели и декора</title>
        <meta name="description" content="Аренда мебели и декора для мероприятий KUDOS" />
      </Head>
      <HeroSection />
    </>
  );
}

import Head from 'next/head';
import Image from 'next/image';

import styles from '../styles/Home.module.css';

export default function Home() {
  return (
    <>
      <Head>
        <title>Kudos Клиентская часть</title>
        <meta name="description" content="Kudos клиентское приложение" />
      </Head>
      <main className={styles.main}>
        <Image
          src="/kudos-logo.svg"
          alt="Kudos logo"
          width={96}
          height={96}
          className={styles.logo}
        />
        <h1 className={styles.title}>Kudos Клиентская часть</h1>
        <p className={styles.subtitle}>
          Добро пожаловать! Клиентский интерфейс скоро будет доступен.
        </p>
      </main>
    </>
  );
}

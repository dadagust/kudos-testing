import Image from 'next/image';
import {FC, useEffect, useState} from 'react';

import {Button} from '../../../../shared/ui/button/Button';
import {Icon} from '../../../../shared/ui/icon/Icon';
import Logo from '../../../../../../static/logo/kudos-logo.svg';

import styles from './hero-section.module.sass';

const TopBar: FC = () => (
  <div className={styles.topBar}>
    <div className={`${styles.container} ${styles.topBarContent}`}>
      <div className={styles.topBarLeft}>
        <div className={styles.contactItem}>
          <Icon name="map-pin" size={20}/>
          <span>МО, Люберцы, квартал 30131, 1020</span>
        </div>
        <a href="mailto:info@kudos.ru" className={styles.contactItem}>
          <Icon name="mail" size={20}/>
          <span>info@kudos.ru</span>
        </a>
        <a href="tel:+74959910579" className={styles.contactItem}>
          <Icon name="phone" size={20}/>
          <span>+7 (495) 991-05-79</span>
        </a>
      </div>

      <div className={styles.topBarRight}>

        <nav className={styles.topNav} aria-label="Ссылки верхнего меню">
          <a href="#">Доставка и самовывоз</a>
          <a href="#">Условия работы</a>
          <a href="#">Вопросы и ответы</a>
        </nav>
      </div>
    </div>
  </div>
);

const FrontendHeader: FC = () => (
  <header className={styles.header}>
    <div className={`${styles.container} ${styles.headerContent}`}>
      <div className={`${styles.headerSide} ${styles.headerLeft}`}>
        <button type="button" className={styles.catalogButton}>
          <Icon name="catalogue" size={20}/>
          <span>Каталог</span>
        </button>
        <label className={styles.searchField}>
          <Icon name="search-icon" size={20}/>
          <input type="text" placeholder="Хочу взять в аренду..." />
        </label>
      </div>

      <div className={styles.logoBlock}>
        <Image src={Logo} alt="KUDOS" width={135} height={42} priority />
      </div>

      <div className={`${styles.headerSide} ${styles.headerRight}`}>
        <div className={styles.iconRow}>
          <button type="button" className={styles.iconButton} aria-label="Избранное">
            <Icon name="heart" size={20}/>
            <span className={styles.counter}>0</span>
          </button>
          <button type="button" className={styles.iconButton} aria-label="Корзина">
            <Icon name="shopping-logo" size={20}/>
            <span className={styles.badge}>2</span>
          </button>
          <button type="button" className={styles.iconButton} aria-label="Личный кабинет">
            <Icon name="user-icon" size={20}/>
          </button>
        </div>
      </div>
    </div>
  </header>
);

export const HeroSection: FC = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const heroImageSrc = isMobile ? '/images/kudos-hero-mobile.jpg' : '/images/kudos-hero-desktop.jpg';

  return (
    <section className={styles.wrapper}>
      <TopBar />
      <FrontendHeader />

      <div className={styles.hero}>
        <div className={styles.heroImage}>
          <Image
            src={heroImageSrc}
            alt="Сервированный стол"
            fill
            priority
            sizes="100vw"
            className={styles.image}
          />
          <div className={styles.heroOverlay}/>
        </div>
        <div className={styles.heroContent}>
          <div className={styles.heroInner}>
            <div className={styles.heroTextBlock}>
              <p className={styles.heroTitle}>
                АРЕНДА
                <br/>
                МЕБЕЛИ И ДЕКОРА
              </p>
              <Button variant="primary" size="lg" className={styles.heroButton}>
                Подробнее
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export {FrontendHeader};

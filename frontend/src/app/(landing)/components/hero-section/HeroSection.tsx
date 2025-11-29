import Image from 'next/image';
import type { FC } from 'react';

import { Button } from '../../../../shared/ui/button/Button';
import { Icon } from '../../../../shared/ui/icon/Icon';

import styles from './hero-section.module.sass';

const TopBar: FC = () => (
  <div className={styles.topBar}>
    <div className={`${styles.container} ${styles.topBarContent}`}>
      <div className={styles.contactItem}>
        <Icon name="map-pin" size={18} />
        <span>МО, Люберцы, квартал 30131, 1020</span>
      </div>
      <div className={styles.contactLinks}>
        <div className={styles.contactItem}>
          <Icon name="mail" size={18} />
          <span>info@kudos.ru</span>
        </div>
        <div className={styles.contactItem}>
          <Icon name="phone" size={18} />
          <span>+7 (495) 991-05-79</span>
        </div>
      </div>
    </div>
  </div>
);

const FrontendHeader: FC = () => (
  <header className={styles.header}>
    <div className={`${styles.container} ${styles.headerContent}`}>
      <div className={styles.headerSide}>
        <button type="button" className={styles.catalogButton}>
          <Icon name="dashboard" size={18} />
          <span>Каталог</span>
        </button>
        <label className={styles.searchField}>
          <Icon name="search" size={18} />
          <input type="text" placeholder="Хочу взять в аренду..." />
        </label>
      </div>

      <div className={styles.logoBlock}>
        <div className={styles.logoText}>KUDOS</div>
        <div className={styles.logoSub}>АРЕНДА МЕБЕЛИ И ДЕКОРА</div>
      </div>

      <div className={styles.headerSide}>
        <nav className={styles.navLinks} aria-label="Главное меню">
          <a href="#">Доставка и самовывоз</a>
          <a href="#">Условия работы</a>
          <a href="#">Вопросы и ответы</a>
        </nav>
        <div className={styles.iconRow}>
          <button type="button" className={styles.iconButton} aria-label="Избранное">
            <Icon name="heart" size={18} />
            <span className={styles.counter}>0</span>
          </button>
          <button type="button" className={styles.iconButton} aria-label="Корзина">
            <Icon name="shopping-logo" size={18} />
            <span className={styles.badge}>2</span>
          </button>
          <button type="button" className={styles.iconButton} aria-label="Личный кабинет">
            <Icon name="user-icon" size={18} />
          </button>
        </div>
      </div>
    </div>
  </header>
);

export const HeroSection: FC = () => (
  <section className={styles.wrapper}>
    <TopBar />
    <FrontendHeader />

    <div className={styles.hero}>
      <div className={styles.heroImage}>
        <Image
          src="/images/kudos-hero-desktop.png"
          alt="Сервированный стол"
          fill
          priority
          sizes="100vw"
          className={styles.image}
        />
        <div className={styles.heroOverlay} />
      </div>

      <div className={styles.heroContent}>
        <div className={styles.heroInner}>
          <div className={styles.heroTextBlock}>
            <p className={styles.heroTitle}>
              АРЕНДА
              <br />
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

export { FrontendHeader };

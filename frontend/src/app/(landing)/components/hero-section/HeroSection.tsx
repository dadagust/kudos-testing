import Image from 'next/image';
import {ChangeEvent, FC, useEffect, useState} from 'react';

import {Button} from '../../../../shared/ui/button/Button';
import {Icon} from '../../../../shared/ui/icon/Icon';
import Logo from '../../../../../../static/logo/kudos-logo.png';

import styles from './hero-section.module.sass';

type NavLink = { href: string; label: string };
type ContactInfo = { icon: string; label: string; href?: string };

const navLinks: NavLink[] = [
  { href: '#', label: 'Каталог' },
  { href: '#', label: 'Условия работы' },
  { href: '#', label: 'Вопросы и ответы' },
  { href: '#', label: 'Доставка и самовывоз' },
];

const contacts: ContactInfo[] = [
  {
    href: 'https://yandex.ru/maps/org/kudos/114603073135/?ll=37.984067%2C55.579811&z=17',
    icon: 'map-pin',
    label: 'МО, Люберцы, квартал 30131, 1020'
  },
  { href: 'mailto:info@kudos.ru', icon: 'mail', label: 'info@kudos.ru' },
  { href: 'tel:+74959910579', icon: 'phone', label: '+7 (495) 991-05-79' },
];

type TopBarProps = {
  isMobile: boolean;
  onMenuToggle: () => void;
  isMenuOpen: boolean;
};

const TopBar: FC<TopBarProps> = ({isMobile, onMenuToggle, isMenuOpen}) => {
  if (!isMobile) {
    return (
      <div className={styles.topBar}>
        <div className={`${styles.container} ${styles.topBarContent}`}>
          <div className={styles.topBarLeft}>
            <a href="https://yandex.ru/maps/org/kudos/114603073135/?ll=37.984067%2C55.579811&z=17">
              <div className={styles.contactItem}>
                <Icon name="map-pin" size={20}/>
                <span>МО, Люберцы, квартал 30131, 1020</span>
              </div>
            </a>
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
  }

  return (
    <div className={styles.topBar}>
      <div className={`${styles.container} ${styles.topBarContentMobile}`}>
        <div className={styles.branding}>
          <button
            type="button"
            className={`${styles.menuButton}${isMenuOpen ? ` ${styles.menuButtonActive}` : ''}`}
            onClick={onMenuToggle}
            aria-label="Открыть меню"
          >
            <Icon name="menu" size={20}/>
          </button>
          <div className={styles.logoBlock}>
            <Image
              src={Logo}
              alt="KUDOS"
              width={typeof window !== 'undefined' && window.innerWidth < 1000 ? 110 : 135}
              height={typeof window !== 'undefined' && window.innerWidth < 1000 ? 34 : 42}
              priority
            />
          </div>
        </div>

        <div className={styles.iconRow}>
          <button type="button" className={styles.iconButton} aria-label="Избранное">
            <Icon name="heart" size={20}/>
            <span className={styles.countText}>0</span>
          </button>
          <button type="button" className={styles.iconButton} aria-label="Корзина">
            <Icon name="shopping-logo" size={20}/>
            <span className={styles.countText}>2</span>
          </button>
          <button type="button" className={styles.iconButton} aria-label="Личный кабинет">
            <Icon name="user-icon" size={20}/>
          </button>
        </div>
      </div>
    </div>
  );
};

type FrontendHeaderProps = {
  isMobile: boolean;
};

const FrontendHeader: FC<FrontendHeaderProps> = ({isMobile}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const isSearchActive = Boolean(searchQuery.trim().length);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleClear = () => {
    setSearchQuery('');
  };

  const searchFieldClassName = `${styles.searchField}${isSearchActive ? ` ${styles.searchFieldActive}` : ''}${isMobile ? ` ${styles.searchFieldMobile}` : ` ${styles.searchFieldDesktop}`}`;
  const searchRowClassName = `${styles.searchRow}${isSearchActive ? ` ${styles.searchRowActive}` : ''}${isMobile ? ` ${styles.searchRowMobile}` : ''}`;
  const catalogButtonClassName = `${styles.catalogButton}${isSearchActive ? ` ${styles.catalogButtonCollapsed}` : ''}`;

  const renderSearchRow = () => (
    <div className={searchRowClassName}>
      <button
        type="button"
        className={catalogButtonClassName}
        aria-hidden={isSearchActive}
        tabIndex={isSearchActive ? -1 : 0}
      >
        <Icon name="catalogue" size={20}/>
        <span>Каталог</span>
      </button>
      <label className={searchFieldClassName}>
        <Icon name="search-icon" size={20}/>
        <input
          type="text"
          placeholder="Хочу взять в аренду..."
          value={searchQuery}
          onChange={handleSearchChange}
        />
        {isSearchActive && (
          <div className={styles.searchActions}>
            <button type="button" className={styles.searchActionButton} onClick={handleClear} aria-label="Очистить поиск">
              <Icon name="close" size={16}/>
            </button>
            <button type="button" className={styles.searchActionButton} aria-label="Перейти в каталог">
              <Icon name="arrow-right" size={16}/>
            </button>
          </div>
        )}
      </label>
    </div>
  );

  return (
    <header className={styles.header}>
      <div className={`${styles.container} ${styles.headerContent}${isMobile ? ` ${styles.headerContentMobile}` : ''}`}>
        {isMobile ? (
          renderSearchRow()
        ) : (
          <>
            <div className={`${styles.headerSide} ${styles.headerLeft}`}>
              {renderSearchRow()}
            </div>

            <div className={styles.logoBlock}>
              <Image src={Logo} alt="KUDOS" width={135} height={42} priority />
            </div>

            <div className={`${styles.headerSide} ${styles.headerRight}`}>
              <div className={styles.iconRow}>
                <button type="button" className={styles.iconButton} aria-label="Избранное">
                  <Icon name="heart" size={20}/>
                  <span className={styles.countText}>0</span>
                </button>
                <button type="button" className={styles.iconButton} aria-label="Корзина">
                  <Icon name="shopping-logo" size={20}/>
                  <span className={styles.countText}>2</span>
                </button>
                <button type="button" className={styles.iconButton} aria-label="Личный кабинет">
                  <Icon name="user-icon" size={20}/>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export const HeroSection: FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1000px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsMenuOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEsc);

    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  const heroImageSrc = isMobile ? '/images/kudos-hero-mobile.jpg' : '/images/kudos-hero-desktop.jpg';

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <section className={styles.wrapper}>
      <TopBar isMobile={isMobile} onMenuToggle={toggleMenu} isMenuOpen={isMenuOpen} />
      <FrontendHeader isMobile={isMobile} />

      {isMobile && (
        <>
          <div
            className={`${styles.menuOverlay}${isMenuOpen ? ` ${styles.menuOverlayVisible}` : ''}`}
            onClick={closeMenu}
            aria-hidden
          />
          <aside className={`${styles.mobileMenu}${isMenuOpen ? ` ${styles.mobileMenuOpen}` : ''}`}>
            <div className={styles.menuContent}>
              <button
                type="button"
                className={styles.menuCloseButton}
                onClick={closeMenu}
                aria-label="Закрыть меню"
              >
                <Icon name="close" size={20}/>
              </button>
              <label className={styles.menuSearchField}>
                <Icon name="search-icon" size={20}/>
                <input type="text" placeholder="Хочу взять в аренду..." />
              </label>

              <nav className={styles.menuNav} aria-label="Мобильное меню">
                {navLinks.map((link) => (
                  <a key={link.label} href={link.href}>
                    {link.label}
                  </a>
                ))}
              </nav>

              <div className={styles.menuContacts}>
                {contacts.map((contact) =>
                  contact.href ? (
                    <a key={contact.label} href={contact.href} className={styles.menuContactItem}>
                      <Icon name={contact.icon} size={20}/>
                      <span>{contact.label}</span>
                    </a>
                  ) : (
                    <div key={contact.label} className={styles.menuContactItem}>
                      <Icon name={contact.icon} size={20}/>
                      <span>{contact.label}</span>
                    </div>
                  )
                )}
              </div>
            </div>
          </aside>
        </>
      )}

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
                АРЕНДА МЕБЕЛИ И ДЕКОРА
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

export {FrontendHeader, TopBar};

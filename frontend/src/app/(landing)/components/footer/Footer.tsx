import Image from 'next/image';
import type { FC } from 'react';

import { Icon } from '../../../../shared/ui/icon/Icon';
import Logo from '../../../../../../static/logo/kudos-logo.png';

import styles from './footer.module.sass';

type FooterLink = { label: string; href: string };

type ContactItem = {
  label: string;
  href?: string;
  icon?: 'map-pin' | 'mail' | 'phone';
};

const clientLinks: FooterLink[] = [
  { href: '#', label: 'Условия работы' },
  { href: '#', label: 'Доставка' },
  { href: '#', label: 'Самовывоз' }
];

const companyLinks: FooterLink[] = [
  { href: '#', label: 'Контакты' },
  { href: '#', label: 'О нас' }
];

const contactItems: ContactItem[] = [
  { href: 'tel:+74959910579', label: '+7 (495) 991-05-79', icon: 'phone' },
  { href: 'mailto:info@kudos.ru', label: 'info@kudos.ru', icon: 'mail' },
  { label: 'Офис: 10:00 — 19:00' },
  { label: 'Доставка: 24/7' },
  {
    href: 'https://yandex.ru/maps/org/kudos/114603073135/?ll=37.984067%2C55.579811&z=17',
    label: 'Московская область, городской округ Люберцы, квартал 30131, 1020',
    icon: 'map-pin'
  }
];

const policyLinks: FooterLink[] = [
  { href: '#', label: 'Договор оферты' },
  { href: '#', label: 'Политика конфиденциальности' }
];

export const FrontendFooter: FC = () => (
  <footer className={styles.footer}>
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.branding}>
          <div className={styles.logoWrapper}>
            <Image src={Logo} alt="KUDOS" width={135} height={42} priority />
          </div>
          <p className={styles.tagline}>АРЕНДА МЕБЕЛИ И ДЕКОРА</p>
          <div className={styles.actionIcons} aria-hidden>
            <Icon name="heart" size={20} />
            <Icon name="shopping-logo" size={20} />
            <Icon name="user-icon" size={20} />
          </div>
        </div>

        <div className={styles.linksColumn}>
          <p className={styles.columnTitle}>КЛИЕНТАМ</p>
          <ul className={styles.linksList}>
            {clientLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.linksColumn}>
          <p className={styles.columnTitle}>О КОМПАНИИ</p>
          <ul className={styles.linksList}>
            {companyLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.contactsColumn}>
          <p className={styles.columnTitle}>СВЯЖИТЕСЬ С НАМИ</p>
          <ul className={styles.contactsList}>
            {contactItems.map((item) => (
              <li key={item.label} className={styles.contactItem}>
                {item.icon ? <Icon name={item.icon} size={18} className={styles.contactIcon} /> : <span className={styles.dot} />}
                {item.href ? (
                  <a href={item.href}>
                    {item.label}
                  </a>
                ) : (
                  <span>{item.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.policies}>
        {policyLinks.map((link, index) => (
          <a key={link.label} href={link.href} className={styles.policyLink}>
            {link.label}
            {index === 0 && <span className={styles.separator}>/</span>}
          </a>
        ))}
      </div>
    </div>
  </footer>
);

export { FrontendFooter as Footer };

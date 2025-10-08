'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Главная' },
  { href: '/catalog', label: 'Каталог' },
  { href: '/cart', label: 'Корзина' },
  { href: '/orders', label: 'Заказы' },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="main-nav">
      {links.map((link) => {
        const isActive = link.href === '/' ? pathname === link.href : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={['main-nav__link', isActive ? 'main-nav__link--active' : ''].join(' ').trim()}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

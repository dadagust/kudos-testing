'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

import { RoleGuard } from '@/features/auth';

import styles from './layout.module.sass';

interface LogisticsLayoutProps {
  children: ReactNode;
}

const TABS = [
  { href: '/logistics/prep', label: 'Подготовка заказа' },
  { href: '/logistics/receiving', label: 'Приёмка' },
];

export default function LogisticsLayout({ children }: LogisticsLayoutProps) {
  const pathname = usePathname();

  return (
    <RoleGuard allow="adminpanel_view_logistics">
      <div className={styles.wrapper}>
        <header className={styles.header}>
          <div>
            <h1>Логистика</h1>
            <p className={styles.subtitle}>Управление подготовкой заказов и приёмкой на склад.</p>
          </div>
          <nav className={styles.tabs}>
            {TABS.map((tab) => {
              const isActive = pathname?.startsWith(tab.href) ?? false;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </RoleGuard>
  );
}

'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ReactNode } from 'react';

import { RoleGuard } from '@/features/auth';
import { Button } from '@/shared/ui';

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
  const router = useRouter();

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
                <Button
                  key={tab.href}
                  type="button"
                  variant={isActive ? 'primary' : 'ghost'}
                  className={styles.tabButton}
                  onClick={() => {
                    router.push(tab.href);
                  }}
                >
                  {tab.label}
                </Button>
              );
            })}
          </nav>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </RoleGuard>
  );
}

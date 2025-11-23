'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FC, KeyboardEvent, ReactNode, useEffect, useState } from 'react';

import { UserProfile } from '@/entities/user';
import { useAuth } from '@/features/auth';
import { NAVIGATION_ITEMS } from '@/shared/config/navigation';
import { hasPermission } from '@/shared/config/permissions';
import { ROLE_TITLES } from '@/shared/config/roles';
import { Button, Icon } from '@/shared/ui';

import styles from './AdminLayout.module.sass';

interface AdminLayoutProps {
  user: UserProfile;
  children: ReactNode;
}

const getAvailableNavItems = (user: UserProfile) =>
  NAVIGATION_ITEMS.filter((item) => hasPermission(user.permissions, item.permission));

export const AdminLayout: FC<AdminLayoutProps> = ({ user, children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const navItems = getAvailableNavItems(user);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const openSidebar = () => setIsSidebarOpen(true);
  const closeSidebar = () => setIsSidebarOpen(false);

  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      closeSidebar();
    }
  };

  useEffect(() => {
    closeSidebar();
  }, [pathname]);

  return (
    <div className={clsx(styles.layout, isSidebarOpen && styles.sidebarOpen)}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link href="/dashboard" className={styles.logo}>
            <Icon name="logo" size={28} />
            Kudos Admin
          </Link>
          <Button
            className={styles.sidebarClose}
            variant="ghost"
            iconLeft="close"
            aria-label="Закрыть меню"
            onClick={closeSidebar}
          >
            Закрыть
          </Button>
        </div>
        <nav className={styles.nav}>
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
                onClick={closeSidebar}
              >
                <Icon name={item.icon} size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div
        className={styles.overlay}
        role="button"
        tabIndex={0}
        aria-label="Закрыть меню"
        onClick={closeSidebar}
        onKeyDown={handleOverlayKeyDown}
      />
      <div className={styles.content}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <Button
              className={styles.menuButton}
              variant="ghost"
              iconLeft="menu"
              aria-label="Открыть меню"
              onClick={openSidebar}
            >
              Меню
            </Button>
            <div>
              <h2>Панель управления</h2>
              <span>Рабочее пространство агрегатора kudos.ru</span>
            </div>
          </div>
          <div className={styles.topbarActions}>
            <Button variant="ghost" iconLeft="user" onClick={() => router.push('/profile')}>
              Профиль
            </Button>
            <div className={styles.user}>
              <span className={styles.userName}>{user.full_name}</span>
              <span className={styles.userRole}>{ROLE_TITLES[user.role]}</span>
            </div>
            <Button variant="ghost" iconLeft="logout" onClick={logout}>
              Выйти
            </Button>
          </div>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
};

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FC, ReactNode } from 'react';

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

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <Link href="/dashboard" className={styles.logo}>
          <Icon name="logo" size={28} />
          Kudos Admin
        </Link>
        <nav className={styles.nav}>
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
              >
                <Icon name={item.icon} size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <h2>Панель управления</h2>
            <span>Рабочее пространство агрегатора kudos.ru</span>
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

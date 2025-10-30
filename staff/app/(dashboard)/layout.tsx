'use client';

import { useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';

import { useAuth } from '@/features/auth';
import { Spinner } from '@/shared/ui';
import { AdminLayout } from '@/widgets/admin-layout';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { status, user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [ready, status, router]);

  if (!ready || status === 'loading') {
    return <Spinner fullscreen label="Загружаем рабочее окружение" />;
  }

  if (!user) {
    return null;
  }

  return <AdminLayout user={user}>{children}</AdminLayout>;
}

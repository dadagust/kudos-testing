'use client';

import { ReactNode } from 'react';

import { AdminSection } from '@/shared/config/roles';
import { Alert } from '@/shared/ui';

import { useAuth } from '../hooks/use-auth';

interface RoleGuardProps {
  section: AdminSection;
  fallback?: ReactNode;
  children: ReactNode;
}

export const RoleGuard = ({ section, fallback, children }: RoleGuardProps) => {
  const { user } = useAuth();

  const hasAccess = Boolean(user?.access?.[section]);

  if (!hasAccess) {
    return (fallback ?? (
      <Alert title="Недостаточно прав" tone="danger">
        Для просмотра раздела необходим доступ к соответствующему разделу.
      </Alert>
    )) as ReactNode;
  }

  return <>{children}</>;
};

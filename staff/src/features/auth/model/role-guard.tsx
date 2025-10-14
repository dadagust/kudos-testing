'use client';

import { ReactNode } from 'react';

import { AdminSection } from '@/shared/config/roles';
import { Alert } from '@/shared/ui';

import { useAuth } from '../hooks/use-auth';

type PermissionKind = 'view' | 'change';

interface RoleGuardProps {
  section: AdminSection;
  permission?: PermissionKind;
  fallback?: ReactNode;
  children: ReactNode;
}

export const RoleGuard = ({ section, permission = 'view', fallback, children }: RoleGuardProps) => {
  const { user } = useAuth();

  const access = user?.access?.[section];
  const isAllowed = permission === 'change' ? access?.change : access?.view;

  if (!user || !access || !isAllowed) {
    return (fallback ?? (
      <Alert title="Недостаточно прав" tone="danger">
        Для доступа к разделу недостаточно прав.
      </Alert>
    )) as ReactNode;
  }

  return <>{children}</>;
};

'use client';

import { ReactNode } from 'react';

import { PermissionCode, hasPermission } from '@/shared/config/permissions';
import { Alert } from '@/shared/ui';

import { useAuth } from '../hooks/use-auth';

interface RoleGuardProps {
  allow: PermissionCode | PermissionCode[];
  mode?: 'all' | 'any';
  fallback?: ReactNode;
  children: ReactNode;
}

export const RoleGuard = ({ allow, mode = 'all', fallback, children }: RoleGuardProps) => {
  const { user } = useAuth();

  const requirements = Array.isArray(allow) ? allow : [allow];

  const hasAccess = requirements.length
    ? mode === 'any'
      ? requirements.some((requirement) => hasPermission(user?.permissions, requirement))
      : requirements.every((requirement) => hasPermission(user?.permissions, requirement))
    : true;

  if (!user || !hasAccess) {
    return (fallback ?? (
      <Alert title="Недостаточно прав" tone="danger">
        Для просмотра раздела необходима другая роль.
      </Alert>
    )) as ReactNode;
  }

  return <>{children}</>;
};

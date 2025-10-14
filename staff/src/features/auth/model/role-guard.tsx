'use client';

import { ReactNode } from 'react';

import { PermissionAction, PermissionScope } from '@/shared/config/permissions';
import { Alert } from '@/shared/ui';

import { useAuth } from '../hooks/use-auth';

type PermissionRequirement =
  | PermissionScope
  | {
      scope: PermissionScope;
      action?: PermissionAction;
    };

interface RoleGuardProps {
  allow: PermissionRequirement | PermissionRequirement[];
  mode?: 'all' | 'any';
  fallback?: ReactNode;
  children: ReactNode;
}

const normalizeRequirement = (requirement: PermissionRequirement) =>
  typeof requirement === 'string'
    ? { scope: requirement, action: 'view' as PermissionAction }
    : { scope: requirement.scope, action: requirement.action ?? ('view' as PermissionAction) };

export const RoleGuard = ({ allow, mode = 'all', fallback, children }: RoleGuardProps) => {
  const { user } = useAuth();

  const requirements = Array.isArray(allow) ? allow : [allow];
  const normalized = requirements.map(normalizeRequirement);

  const hasAccess = normalized.length
    ? mode === 'any'
      ? normalized.some((requirement) =>
          Boolean(user?.permissions?.[requirement.scope]?.[requirement.action])
        )
      : normalized.every((requirement) =>
          Boolean(user?.permissions?.[requirement.scope]?.[requirement.action])
        )
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

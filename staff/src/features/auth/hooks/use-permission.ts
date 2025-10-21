'use client';

import { PermissionCode, hasPermission } from '@/shared/config/permissions';

import { useAuth } from './use-auth';

export const usePermission = (permission: PermissionCode) => {
  const { user } = useAuth();
  return hasPermission(user?.permissions, permission);
};

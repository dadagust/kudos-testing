'use client';

import { PermissionAction, PermissionScope } from '@/shared/config/permissions';

import { useAuth } from './use-auth';

export const usePermission = (scope: PermissionScope, action: PermissionAction = 'view') => {
  const { user } = useAuth();
  return Boolean(user?.permissions?.[scope]?.[action]);
};

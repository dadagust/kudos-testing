export const PERMISSION_SCOPES = [
  'admin_dashboard',
  'admin_products',
  'admin_orders',
  'admin_customers',
  'admin_inventory',
  'admin_documents',
  'admin_integrations',
  'admin_settings',
  'admin_logs',
  'customers',
  'companies',
  'addresses',
  'contacts',
  'orders',
  'inventory',
  'documents',
] as const;

export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

export type PermissionAction = 'view' | 'change';

export interface PermissionFlags {
  view: boolean;
  change: boolean;
}

export type PermissionMatrix = Record<PermissionScope, PermissionFlags>;

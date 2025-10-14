import { PermissionScope } from './permissions';
import { AdminSection } from './roles';

export interface NavigationItem {
  id: AdminSection;
  label: string;
  href: string;
  icon: string;
  permission: PermissionScope;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Дашборд',
    href: '/dashboard',
    icon: 'dashboard',
    permission: 'admin_dashboard',
  },
  {
    id: 'products',
    label: 'Товары',
    href: '/products',
    icon: 'box',
    permission: 'admin_products',
  },
  {
    id: 'orders',
    label: 'Заказы',
    href: '/orders',
    icon: 'orders',
    permission: 'admin_orders',
  },
  {
    id: 'customers',
    label: 'Клиенты',
    href: '/customers',
    icon: 'customers',
    permission: 'admin_customers',
  },
  {
    id: 'inventory',
    label: 'Склад',
    href: '/inventory',
    icon: 'inventory',
    permission: 'admin_inventory',
  },
  {
    id: 'documents',
    label: 'Документы',
    href: '/documents',
    icon: 'documents',
    permission: 'admin_documents',
  },
  {
    id: 'integrations',
    label: 'Интеграции',
    href: '/integrations',
    icon: 'integrations',
    permission: 'admin_integrations',
  },
  {
    id: 'settings',
    label: 'Настройки',
    href: '/settings',
    icon: 'settings',
    permission: 'admin_settings',
  },
  {
    id: 'logs',
    label: 'Логи',
    href: '/logs',
    icon: 'logs',
    permission: 'admin_logs',
  },
];

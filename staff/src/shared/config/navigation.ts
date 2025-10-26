import { PermissionCode } from './permissions';
import { AdminSection } from './roles';

export interface NavigationItem {
  id: AdminSection;
  label: string;
  href: string;
  icon: string;
  permission: PermissionCode;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Дашборд',
    href: '/dashboard',
    icon: 'dashboard',
    permission: 'adminpanel_view_dashboard',
  },
  {
    id: 'products',
    label: 'Прайс-лист',
    href: '/products',
    icon: 'box',
    permission: 'adminpanel_view_products',
  },
  {
    id: 'orders',
    label: 'Заказы',
    href: '/orders',
    icon: 'orders',
    permission: 'adminpanel_view_orders',
  },
  {
    id: 'customers',
    label: 'Клиенты',
    href: '/customers',
    icon: 'customers',
    permission: 'adminpanel_view_customers',
  },
  {
    id: 'inventory',
    label: 'Склад',
    href: '/inventory',
    icon: 'inventory',
    permission: 'adminpanel_view_inventory',
  },
  {
    id: 'documents',
    label: 'Документы',
    href: '/documents',
    icon: 'documents',
    permission: 'adminpanel_view_documents',
  },
  {
    id: 'integrations',
    label: 'Интеграции',
    href: '/integrations',
    icon: 'integrations',
    permission: 'adminpanel_view_integrations',
  },
  {
    id: 'settings',
    label: 'Настройки',
    href: '/settings',
    icon: 'settings',
    permission: 'adminpanel_view_settings',
  },
  {
    id: 'logs',
    label: 'Логи',
    href: '/logs',
    icon: 'logs',
    permission: 'adminpanel_view_logs',
  },
];

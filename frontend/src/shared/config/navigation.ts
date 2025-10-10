import { AdminSection, Role, RoleKey } from './roles';

export interface NavigationItem {
  id: AdminSection;
  label: string;
  href: string;
  icon: string;
  roles: RoleKey[];
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Дашборд',
    href: '/dashboard',
    icon: 'dashboard',
    roles: [
      Role.Customer,
      Role.B2B,
      Role.SalesManager,
      Role.Warehouse,
      Role.Accountant,
      Role.ContentManager,
      Role.Admin,
      Role.Driver,
      Role.Loader,
    ],
  },
  {
    id: 'products',
    label: 'Товары',
    href: '/products',
    icon: 'box',
    roles: [Role.SalesManager, Role.ContentManager, Role.Admin],
  },
  {
    id: 'orders',
    label: 'Заказы',
    href: '/orders',
    icon: 'orders',
    roles: [
      Role.SalesManager,
      Role.Warehouse,
      Role.Accountant,
      Role.Admin,
      Role.Driver,
      Role.Loader,
    ],
  },
  {
    id: 'customers',
    label: 'Клиенты',
    href: '/customers',
    icon: 'customers',
    roles: [Role.SalesManager, Role.Accountant, Role.Admin],
  },
  {
    id: 'inventory',
    label: 'Склад',
    href: '/inventory',
    icon: 'inventory',
    roles: [Role.SalesManager, Role.Warehouse, Role.Admin, Role.Loader],
  },
  {
    id: 'documents',
    label: 'Документы',
    href: '/documents',
    icon: 'documents',
    roles: [Role.SalesManager, Role.Accountant, Role.ContentManager, Role.Admin],
  },
  {
    id: 'integrations',
    label: 'Интеграции',
    href: '/integrations',
    icon: 'integrations',
    roles: [Role.Admin],
  },
  {
    id: 'settings',
    label: 'Настройки',
    href: '/settings',
    icon: 'settings',
    roles: [Role.Admin],
  },
  {
    id: 'logs',
    label: 'Логи',
    href: '/logs',
    icon: 'logs',
    roles: [Role.SalesManager, Role.Warehouse, Role.Accountant, Role.Admin],
  },
];

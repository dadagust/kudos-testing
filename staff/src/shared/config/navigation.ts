import { Role, RoleKey } from "./roles";

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  roles: RoleKey[];
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: "dashboard",
    label: "Дашборд",
    href: "/dashboard",
    icon: "dashboard",
    roles: [
      Role.Client,
      Role.B2B,
      Role.Manager,
      Role.Warehouse,
      Role.Accountant,
      Role.ContentManager,
      Role.Administrator,
    ],
  },
  {
    id: "products",
    label: "Товары",
    href: "/products",
    icon: "box",
    roles: [Role.Manager, Role.ContentManager, Role.Administrator],
  },
  {
    id: "orders",
    label: "Заказы",
    href: "/orders",
    icon: "orders",
    roles: [Role.Manager, Role.Warehouse, Role.Accountant, Role.Administrator],
  },
  {
    id: "customers",
    label: "Клиенты",
    href: "/customers",
    icon: "customers",
    roles: [Role.Manager, Role.Accountant, Role.Administrator],
  },
  {
    id: "inventory",
    label: "Склад",
    href: "/inventory",
    icon: "inventory",
    roles: [Role.Manager, Role.Warehouse, Role.Administrator],
  },
  {
    id: "documents",
    label: "Документы",
    href: "/documents",
    icon: "documents",
    roles: [Role.Manager, Role.Accountant, Role.ContentManager, Role.Administrator],
  },
  {
    id: "integrations",
    label: "Интеграции",
    href: "/integrations",
    icon: "integrations",
    roles: [Role.Administrator],
  },
  {
    id: "settings",
    label: "Настройки",
    href: "/settings",
    icon: "settings",
    roles: [Role.Administrator],
  },
  {
    id: "logs",
    label: "Логи",
    href: "/logs",
    icon: "logs",
    roles: [Role.Manager, Role.Warehouse, Role.Accountant, Role.Administrator],
  },
];

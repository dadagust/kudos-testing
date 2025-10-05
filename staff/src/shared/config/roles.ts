export enum Role {
  Guest = 'guest',
  Client = 'client',
  B2B = 'b2b',
  Manager = 'manager',
  Warehouse = 'warehouse',
  Accountant = 'accountant',
  ContentManager = 'content_manager',
  Administrator = 'administrator',
}

export type RoleKey = `${Role}`;

export const ROLE_TITLES: Record<Role, string> = {
  [Role.Guest]: 'Гость',
  [Role.Client]: 'Клиент',
  [Role.B2B]: 'B2B Клиент',
  [Role.Manager]: 'Менеджер продаж',
  [Role.Warehouse]: 'Склад / Логистика',
  [Role.Accountant]: 'Бухгалтерия',
  [Role.ContentManager]: 'Контент-менеджер',
  [Role.Administrator]: 'Администратор',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  [Role.Guest]: 'Просмотр витрины, публичные страницы и калькуляторы без авторизации.',
  [Role.Client]: 'Личный кабинет с заказами, документами, платежами и профилем.',
  [Role.B2B]: 'Корпоративный кабинет с тарифами, документами и опциональным постоплатным режимом.',
  [Role.Manager]: 'Управление заказами, резервами, расчетами и печатью документов.',
  [Role.Warehouse]: 'Доступ к календарю сборки, выдаче, маршрутам и фиксации повреждений.',
  [Role.Accountant]: 'Выставление счетов, фиксация оплат, отчеты и возвраты залога.',
  [Role.ContentManager]: 'Ведение каталога товаров, комплектов, тегов и контента.',
  [Role.Administrator]: 'Полный доступ к настройкам, ролям, интеграциям и мониторингу.',
};

export const ADMIN_SECTIONS = [
  'dashboard',
  'products',
  'orders',
  'customers',
  'inventory',
  'documents',
  'integrations',
  'settings',
  'logs',
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export const ROLE_SECTION_ACCESS: Record<Role, AdminSection[]> = {
  [Role.Guest]: [],
  [Role.Client]: ['dashboard'],
  [Role.B2B]: ['dashboard'],
  [Role.Manager]: [
    'dashboard',
    'products',
    'orders',
    'customers',
    'inventory',
    'documents',
    'logs',
  ],
  [Role.Warehouse]: ['dashboard', 'orders', 'inventory', 'logs'],
  [Role.Accountant]: ['dashboard', 'orders', 'customers', 'documents', 'logs'],
  [Role.ContentManager]: ['dashboard', 'products', 'documents'],
  [Role.Administrator]: [
    'dashboard',
    'products',
    'orders',
    'customers',
    'inventory',
    'documents',
    'integrations',
    'settings',
    'logs',
  ],
};

export const DEFAULT_ROLE = Role.Manager;

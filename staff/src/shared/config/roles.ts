export enum Role {
  Guest = 'guest',
  Customer = 'customer',
  B2B = 'b2b',
  SalesManager = 'sales_manager',
  Warehouse = 'warehouse',
  Accountant = 'accountant',
  ContentManager = 'content_manager',
  Admin = 'admin',
  Driver = 'driver',
  Loader = 'loader',
}

export type RoleKey = `${Role}`;

export const ROLE_TITLES: Record<Role, string> = {
  [Role.Guest]: 'Гость',
  [Role.Customer]: 'Клиент',
  [Role.B2B]: 'B2B Клиент',
  [Role.SalesManager]: 'Менеджер продаж',
  [Role.Warehouse]: 'Склад / Логистика',
  [Role.Accountant]: 'Бухгалтерия',
  [Role.ContentManager]: 'Контент-менеджер',
  [Role.Admin]: 'Администратор',
  [Role.Driver]: 'Водитель',
  [Role.Loader]: 'Грузчик',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  [Role.Guest]: 'Просмотр витрины, публичные страницы и калькуляторы без авторизации.',
  [Role.Customer]: 'Личный кабинет с заказами, документами, платежами и профилем.',
  [Role.B2B]: 'Корпоративный кабинет с тарифами, документами и опциональным постоплатным режимом.',
  [Role.SalesManager]: 'Управление заказами, резервами, расчетами и печатью документов.',
  [Role.Warehouse]: 'Доступ к календарю сборки, выдаче, маршрутам и фиксации повреждений.',
  [Role.Accountant]: 'Выставление счетов, фиксация оплат, отчеты и возвраты залога.',
  [Role.ContentManager]: 'Ведение каталога товаров, комплектов, тегов и контента.',
  [Role.Admin]: 'Полный доступ к настройкам, ролям, интеграциям и мониторингу.',
  [Role.Driver]: 'Маршруты доставки и актуальный статус выдачи заказов.',
  [Role.Loader]: 'Календарь выдачи/приёмки и складские операции.',
};

export const ADMIN_SECTIONS = [
  'dashboard',
  'products',
  'orders',
  'logistics',
  'customers',
  'inventory',
  'logs',
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export const DEFAULT_ROLE = Role.SalesManager;

ADMIN_SECTIONS = [
    'dashboard',
    'products',
    'orders',
    'customers',
    'inventory',
    'documents',
    'integrations',
    'settings',
    'logs',
]

ROLE_ACCESS_MATRIX = {
    'guest': [],
    'client': ['dashboard'],
    'b2b': ['dashboard'],
    'manager': ['dashboard', 'products', 'orders', 'customers', 'inventory', 'documents', 'logs'],
    'warehouse': ['dashboard', 'orders', 'inventory', 'logs'],
    'accountant': ['dashboard', 'orders', 'customers', 'documents', 'logs'],
    'content_manager': ['dashboard', 'products', 'documents'],
    'administrator': ADMIN_SECTIONS,
}

ROLE_DESCRIPTIONS = {
    'guest': 'Просмотр публичных страниц без авторизации.',
    'client': 'Личный кабинет частного клиента.',
    'b2b': 'Личный кабинет корпоративного клиента.',
    'manager': 'Работа с заказами, статусами и документами.',
    'warehouse': 'Операции склада и логистики.',
    'accountant': 'Финансы, счета и отчеты.',
    'content_manager': 'Каталог, карточки товаров и контент.',
    'administrator': 'Полный доступ к настройкам и интеграциям.',
}

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
    'customer': ['dashboard'],
    'b2b': ['dashboard'],
    'sales_manager': [
        'dashboard',
        'products',
        'orders',
        'customers',
        'inventory',
        'documents',
        'logs',
    ],
    'warehouse': ['dashboard', 'orders', 'inventory', 'logs'],
    'accountant': ['dashboard', 'orders', 'customers', 'documents', 'logs'],
    'content_manager': ['dashboard', 'products', 'documents'],
    'driver': ['dashboard', 'orders'],
    'loader': ['dashboard', 'orders', 'inventory'],
    'admin': ADMIN_SECTIONS,
}

ROLE_DESCRIPTIONS = {
    'guest': 'Просмотр публичных страниц без авторизации.',
    'customer': 'Личный кабинет частного клиента.',
    'b2b': 'Личный кабинет корпоративного клиента.',
    'sales_manager': 'Работа с заказами, статусами и документами.',
    'warehouse': 'Операции склада и логистики.',
    'accountant': 'Финансы, счета и отчеты.',
    'content_manager': 'Каталог, карточки товаров и контент.',
    'driver': 'Маршруты и выдача заказов.',
    'loader': 'Выдача и приёмка заказов на складе.',
    'admin': 'Полный доступ к настройкам и интеграциям.',
}

"""Constants shared across the users application."""

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

#: Mapping between admin sections and the permissions required to access them.
#: Each entry contains two keys:
#:   - ``view``: a collection of permission codes that allow read-only access.
#:   - ``change``: permission codes that unlock editing capabilities.
#:
#: The mapping intentionally references permissions created by the RBAC
#: migration (see ``applications.users.migrations.0003_create_role_groups``),
#: even for domains that are not yet implemented. This keeps the front-end in
#: sync with the long-term access matrix from the product requirements.
SECTION_PERMISSION_REQUIREMENTS = {
    'customers': {
        'view': (
            'customers.view_customer',
            'customers.view_company',
            'customers.view_address',
            'customers.view_contact',
        ),
        'change': (
            'customers.add_customer',
            'customers.change_customer',
            'customers.delete_customer',
            'customers.add_company',
            'customers.change_company',
            'customers.delete_company',
            'customers.add_address',
            'customers.change_address',
            'customers.delete_address',
            'customers.add_contact',
            'customers.change_contact',
            'customers.delete_contact',
        ),
    },
    'orders': {
        'view': ('orders.view_order',),
        'change': (
            'orders.add_order',
            'orders.change_order',
            'orders.delete_order',
        ),
    },
    'inventory': {
        'view': ('inventory.view_inventoryitem',),
        'change': (
            'inventory.add_inventoryitem',
            'inventory.change_inventoryitem',
            'inventory.delete_inventoryitem',
        ),
    },
    'documents': {
        'view': ('documents.view_document',),
        'change': (
            'documents.add_document',
            'documents.change_document',
            'documents.delete_document',
        ),
    },
    # Sections "products", "integrations", "settings" and "logs" currently
    # rely on full admin access. They remain in the matrix so that the
    # front-end renders them for administrators while keeping the structure
    # future-proof when dedicated models appear.
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

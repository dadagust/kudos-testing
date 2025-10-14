"""RBAC configuration for kudos.ru roles."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, Sequence

from .models import RoleChoices

ROLE_GROUP_MAP: Mapping[str, str] = {
    RoleChoices.GUEST: 'Guest',
    RoleChoices.CUSTOMER: 'Customer',
    RoleChoices.B2B: 'B2B',
    RoleChoices.SALES_MANAGER: 'SalesManager',
    RoleChoices.WAREHOUSE: 'Warehouse',
    RoleChoices.ACCOUNTANT: 'Accountant',
    RoleChoices.CONTENT_MANAGER: 'ContentManager',
    RoleChoices.ADMIN: 'Admin',
    RoleChoices.DRIVER: 'Driver',
    RoleChoices.LOADER: 'Loader',
}

STAFF_ROLE_CODES: frozenset[str] = frozenset(
    {
        RoleChoices.SALES_MANAGER,
        RoleChoices.WAREHOUSE,
        RoleChoices.ACCOUNTANT,
        RoleChoices.CONTENT_MANAGER,
        RoleChoices.ADMIN,
        RoleChoices.DRIVER,
        RoleChoices.LOADER,
    }
)

NON_STAFF_ROLE_CODES: frozenset[str] = frozenset(
    {RoleChoices.GUEST, RoleChoices.CUSTOMER, RoleChoices.B2B}
)

ROLE_PERMISSION_MATRIX: Mapping[str, Mapping[tuple[str, str], Sequence[str]]] = {
    'Guest': {
        ('inventory', 'inventoryitem'): ('view',),
    },
    'Customer': {
        ('customers', 'customer'): ('view', 'change'),
        ('customers', 'company'): ('view', 'change'),
        ('customers', 'address'): ('view', 'change'),
        ('customers', 'contact'): ('view', 'change'),
        ('orders', 'order'): ('view',),
        ('inventory', 'inventoryitem'): ('view',),
        ('documents', 'document'): ('view',),
    },
    'B2B': {
        ('customers', 'customer'): ('view', 'change'),
        ('customers', 'company'): ('view', 'change'),
        ('customers', 'address'): ('view', 'change'),
        ('customers', 'contact'): ('view', 'change'),
        ('orders', 'order'): ('view',),
        ('inventory', 'inventoryitem'): ('view',),
        ('documents', 'document'): ('view',),
    },
    'SalesManager': {
        ('customers', 'customer'): ('view', 'add', 'change', 'delete'),
        ('customers', 'company'): ('view', 'change'),
        ('customers', 'address'): ('view', 'change'),
        ('customers', 'contact'): ('view', 'change'),
        ('orders', 'order'): ('view', 'add', 'change', 'delete'),
        ('inventory', 'inventoryitem'): ('view',),
        ('documents', 'document'): ('view',),
        ('adminpanel', 'dashboard'): ('view',),
        ('adminpanel', 'products'): ('view',),
        ('adminpanel', 'orders'): ('view',),
        ('adminpanel', 'customers'): ('view',),
        ('adminpanel', 'inventory'): ('view',),
        ('adminpanel', 'documents'): ('view',),
        ('adminpanel', 'logs'): ('view',),
    },
    'Warehouse': {
        ('customers', 'customer'): ('view',),
        ('customers', 'company'): ('view',),
        ('customers', 'address'): ('view',),
        ('customers', 'contact'): ('view',),
        ('orders', 'order'): ('view',),
        ('inventory', 'inventoryitem'): ('view', 'change'),
        ('documents', 'document'): ('view',),
        ('adminpanel', 'dashboard'): ('view',),
        ('adminpanel', 'orders'): ('view',),
        ('adminpanel', 'inventory'): ('view',),
        ('adminpanel', 'logs'): ('view',),
    },
    'Accountant': {
        ('customers', 'customer'): ('view',),
        ('customers', 'company'): ('view',),
        ('customers', 'address'): ('view',),
        ('customers', 'contact'): ('view',),
        ('orders', 'order'): ('view', 'change'),
        ('documents', 'document'): ('view', 'change'),
        ('adminpanel', 'dashboard'): ('view',),
        ('adminpanel', 'orders'): ('view',),
        ('adminpanel', 'customers'): ('view',),
        ('adminpanel', 'documents'): ('view',),
        ('adminpanel', 'logs'): ('view',),
    },
    'ContentManager': {
        ('inventory', 'inventoryitem'): ('view',),
        ('adminpanel', 'dashboard'): ('view',),
        ('adminpanel', 'products'): ('view',),
        ('adminpanel', 'documents'): ('view',),
    },
    'Driver': {
        ('customers', 'customer'): ('view',),
        ('orders', 'order'): ('view',),
        ('inventory', 'inventoryitem'): ('view',),
        ('adminpanel', 'dashboard'): ('view',),
        ('adminpanel', 'orders'): ('view',),
    },
    'Loader': {
        ('customers', 'customer'): ('view',),
        ('orders', 'order'): ('view',),
        ('inventory', 'inventoryitem'): ('view', 'change'),
        ('adminpanel', 'dashboard'): ('view',),
        ('adminpanel', 'orders'): ('view',),
        ('adminpanel', 'inventory'): ('view',),
    },
    'Admin': {
        ('adminpanel', 'dashboard'): ('view', 'change'),
        ('adminpanel', 'products'): ('view', 'change'),
        ('adminpanel', 'orders'): ('view', 'change'),
        ('adminpanel', 'customers'): ('view', 'change'),
        ('adminpanel', 'inventory'): ('view', 'change'),
        ('adminpanel', 'documents'): ('view', 'change'),
        ('adminpanel', 'integrations'): ('view', 'change'),
        ('adminpanel', 'settings'): ('view', 'change'),
        ('adminpanel', 'logs'): ('view', 'change'),
    },
}


def flatten_required_permissions() -> dict[tuple[str, str], set[str]]:
    accumulator: dict[tuple[str, str], set[str]] = defaultdict(set)
    for mapping in ROLE_PERMISSION_MATRIX.values():
        for (app_label, model), actions in mapping.items():
            accumulator[(app_label, model)].update(actions)
    return accumulator


__all__ = [
    'ROLE_GROUP_MAP',
    'STAFF_ROLE_CODES',
    'NON_STAFF_ROLE_CODES',
    'ROLE_PERMISSION_MATRIX',
    'flatten_required_permissions',
]

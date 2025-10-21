"""RBAC configuration for kudos.ru roles."""

from __future__ import annotations

from collections.abc import Mapping

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


__all__ = [
    'ROLE_GROUP_MAP',
    'STAFF_ROLE_CODES',
    'NON_STAFF_ROLE_CODES',
]

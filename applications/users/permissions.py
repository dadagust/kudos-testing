"""Helpers for serialising user permissions into a frontend-friendly shape."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Mapping

PermissionMap = dict[str, dict[str, bool]]


PERMISSION_SCOPE_DEFINITIONS: Mapping[str, Mapping[str, Iterable[str]]] = {
    'admin_dashboard': {
        'view': ('adminpanel.view_dashboard',),
        'change': ('adminpanel.change_dashboard',),
    },
    'admin_products': {
        'view': ('adminpanel.view_products',),
        'change': ('adminpanel.change_products',),
    },
    'admin_orders': {
        'view': ('adminpanel.view_orders',),
        'change': ('adminpanel.change_orders',),
    },
    'admin_customers': {
        'view': ('adminpanel.view_customers',),
        'change': ('adminpanel.change_customers',),
    },
    'admin_inventory': {
        'view': ('adminpanel.view_inventory',),
        'change': ('adminpanel.change_inventory',),
    },
    'admin_documents': {
        'view': ('adminpanel.view_documents',),
        'change': ('adminpanel.change_documents',),
    },
    'admin_integrations': {
        'view': ('adminpanel.view_integrations',),
        'change': ('adminpanel.change_integrations',),
    },
    'admin_settings': {
        'view': ('adminpanel.view_settings',),
        'change': ('adminpanel.change_settings',),
    },
    'admin_logs': {
        'view': ('adminpanel.view_logs',),
        'change': ('adminpanel.change_logs',),
    },
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
    'companies': {
        'view': ('customers.view_company',),
        'change': (
            'customers.add_company',
            'customers.change_company',
            'customers.delete_company',
        ),
    },
    'addresses': {
        'view': ('customers.view_address',),
        'change': (
            'customers.add_address',
            'customers.change_address',
            'customers.delete_address',
        ),
    },
    'contacts': {
        'view': ('customers.view_contact',),
        'change': (
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
}


def _has_any(user_permissions: set[str], codes: Iterable[str]) -> bool:
    return any(code in user_permissions for code in codes)


def serialize_user_permissions(user) -> PermissionMap:
    permissions = {scope: {'view': False, 'change': False} for scope in PERMISSION_SCOPE_DEFINITIONS}
    if not getattr(user, 'is_authenticated', False):
        return permissions

    user_permissions = set(user.get_all_permissions())

    for scope, actions in PERMISSION_SCOPE_DEFINITIONS.items():
        view_codes = tuple(actions.get('view', ()))
        change_codes = tuple(actions.get('change', ()))
        permissions[scope] = {
            'view': _has_any(user_permissions, view_codes) if view_codes else False,
            'change': _has_any(user_permissions, change_codes) if change_codes else False,
        }

    return permissions


__all__ = ['PermissionMap', 'PERMISSION_SCOPE_DEFINITIONS', 'serialize_user_permissions']

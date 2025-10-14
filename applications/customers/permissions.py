"""Permission helpers for customer API endpoints."""

from __future__ import annotations

from rest_framework.permissions import BasePermission, SAFE_METHODS


class CustomerAccessPolicy(BasePermission):
    message = 'Недостаточно прав для выполнения операции с клиентами.'

    def has_permission(self, request, view) -> bool:  # type: ignore[override]
        user = request.user
        if not user or not user.is_authenticated:
            return False

        method = request.method

        if method in SAFE_METHODS:
            return user.has_perm('customers.view_customer')

        if method == 'POST':
            return user.has_perm('customers.add_customer')

        if method in {'PUT', 'PATCH'}:
            return user.has_perm('customers.change_customer')

        if method == 'DELETE':
            return user.has_perm('customers.delete_customer')

        return False

    def has_object_permission(self, request, view, obj) -> bool:  # type: ignore[override]
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            if user.is_staff:
                return True
            return getattr(obj, 'owner_id', None) == user.id

        if user.has_perm('customers.change_customer') or user.has_perm('customers.delete_customer'):
            if user.is_staff:
                return True
            return getattr(obj, 'owner_id', None) == user.id

        return False

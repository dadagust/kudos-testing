"""Permission helpers for order API endpoints."""

from __future__ import annotations

from rest_framework.permissions import SAFE_METHODS, BasePermission


class OrderAccessPolicy(BasePermission):
    message = 'Недостаточно прав для выполнения операции с заказами.'

    def has_permission(self, request, view) -> bool:  # type: ignore[override]
        user = request.user
        if not user or not user.is_authenticated:
            return False

        method = request.method

        if method in SAFE_METHODS:
            return user.has_perm('orders.view_order')

        if method == 'POST':
            return user.has_perm('orders.add_order')

        if method in {'PUT', 'PATCH'}:
            return user.has_perm('orders.change_order')

        if method == 'DELETE':
            return user.has_perm('orders.delete_order')

        return False

    def has_object_permission(self, request, view, obj) -> bool:  # type: ignore[override]
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return user.has_perm('orders.view_order')

        if request.method in {'PUT', 'PATCH'}:
            return user.has_perm('orders.change_order')

        if request.method == 'DELETE':
            return user.has_perm('orders.delete_order')

        return False

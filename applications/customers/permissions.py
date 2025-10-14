"""Permission helpers for customer API endpoints."""

from __future__ import annotations

from rest_framework.permissions import BasePermission

from applications.users.models import RoleChoices


class CustomerAccessPolicy(BasePermission):
    message = 'Недостаточно прав для выполнения операции с клиентами.'

    def has_permission(self, request, view) -> bool:  # type: ignore[override]
        user = request.user
        if not user or not user.is_authenticated:
            return False

        role = getattr(getattr(user, 'profile', None), 'role', RoleChoices.CUSTOMER)
        action = getattr(view, 'action', request.method.lower())

        if action in {'list', 'retrieve'} or request.method in {'GET', 'HEAD', 'OPTIONS'}:
            return role not in {RoleChoices.GUEST, RoleChoices.CONTENT_MANAGER}

        if action == 'create':
            return role in {RoleChoices.SALES_MANAGER, RoleChoices.ADMIN}

        if action in {'update', 'partial_update'}:
            return role in {
                RoleChoices.CUSTOMER,
                RoleChoices.B2B,
                RoleChoices.SALES_MANAGER,
                RoleChoices.ADMIN,
            }

        if action == 'destroy':
            return role in {RoleChoices.SALES_MANAGER, RoleChoices.ADMIN}

        return False

    def has_object_permission(self, request, view, obj) -> bool:  # type: ignore[override]
        user = request.user
        role = getattr(getattr(user, 'profile', None), 'role', RoleChoices.CUSTOMER)

        if role in {RoleChoices.ADMIN, RoleChoices.SALES_MANAGER}:
            return True

        if role in {RoleChoices.CUSTOMER, RoleChoices.B2B}:
            return getattr(obj, 'owner_id', None) == user.id

        return request.method in {'GET', 'HEAD', 'OPTIONS'}

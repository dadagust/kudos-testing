from __future__ import annotations

from rest_framework.permissions import SAFE_METHODS, BasePermission

from applications.core.models import RoleChoices


class CustomerAccessPermission(BasePermission):
    message = 'Недостаточно прав для выполнения действия'

    def _get_role(self, user) -> str | None:
        profile = getattr(user, 'profile', None)
        return getattr(profile, 'role', None)

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True

        role = self._get_role(user)
        if role is None:
            return False

        if request.method in SAFE_METHODS:
            return role != RoleChoices.GUEST

        if role in {RoleChoices.SALES_MANAGER, RoleChoices.ADMIN}:
            return True

        if request.method in {'PUT', 'PATCH'} and role in {RoleChoices.CUSTOMER, RoleChoices.B2B}:
            return True

        return False

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True

        role = self._get_role(user)
        if role is None:
            return False

        if request.method in SAFE_METHODS:
            if role in {RoleChoices.CUSTOMER, RoleChoices.B2B}:
                return obj.owner_id == user.id
            return role != RoleChoices.GUEST

        if role in {RoleChoices.SALES_MANAGER, RoleChoices.ADMIN}:
            return True

        if request.method in {'PUT', 'PATCH'} and role in {RoleChoices.CUSTOMER, RoleChoices.B2B}:
            return obj.owner_id == user.id

        return False

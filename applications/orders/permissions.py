"""Access policies for order endpoints."""

from __future__ import annotations

from rest_framework.permissions import SAFE_METHODS, BasePermission

from applications.core.models import RoleChoices


class OrderAccessPolicy(BasePermission):
    """Enforce role-based access on order resources."""

    message = 'У вас нет прав для выполнения этого действия.'

    def has_permission(self, request, view) -> bool:  # type: ignore[override]
        user = request.user
        if not getattr(user, 'is_authenticated', False):
            return False

        profile = getattr(user, 'profile', None)
        role = getattr(profile, 'role', RoleChoices.GUEST if profile else RoleChoices.GUEST)

        if request.method in SAFE_METHODS:
            return role in (
                RoleChoices.ADMIN,
                RoleChoices.SALES_MANAGER,
                RoleChoices.WAREHOUSE,
                RoleChoices.ACCOUNTANT,
                RoleChoices.CONTENT_MANAGER,
                RoleChoices.DRIVER,
                RoleChoices.LOADER,
                RoleChoices.CUSTOMER,
                RoleChoices.B2B,
            )

        if request.method == 'POST':
            return role in (RoleChoices.ADMIN, RoleChoices.SALES_MANAGER)

        if request.method in {'PUT', 'PATCH'}:
            return role in (RoleChoices.ADMIN, RoleChoices.SALES_MANAGER, RoleChoices.ACCOUNTANT)

        if request.method == 'DELETE':
            return role in (RoleChoices.ADMIN, RoleChoices.SALES_MANAGER)

        return False

    def has_object_permission(self, request, view, obj) -> bool:  # type: ignore[override]
        return self.has_permission(request, view)


__all__ = ['OrderAccessPolicy']

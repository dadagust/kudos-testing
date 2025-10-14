"""Helpers for building permission matrices for staff users."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from django.contrib.auth.models import AbstractBaseUser

from .constants import ADMIN_SECTIONS, SECTION_PERMISSION_REQUIREMENTS
from .models import RoleChoices


PermissionMatrix = dict[str, dict[str, bool]]


def _has_any_permission(
    permissions: set[str], required: Mapping[str, Any] | tuple[str, ...] | list[str] | set[str]
) -> bool:
    """Return ``True`` if any of the required permissions is present."""

    if not required:
        return False

    if isinstance(required, Mapping):
        values = list(required.values())
        return any(_has_any_permission(permissions, value) for value in values)

    return any(code in permissions for code in required)


def build_access_matrix(user: AbstractBaseUser, role: str | None) -> PermissionMatrix:
    """Build an access matrix with ``view``/``change`` flags per admin section."""

    matrix: PermissionMatrix = {
        section: {'view': False, 'change': False} for section in ADMIN_SECTIONS
    }

    if role == RoleChoices.ADMIN or getattr(user, 'is_superuser', False):
        for section in matrix.values():
            section['view'] = True
            section['change'] = True
        return matrix

    permissions = set(user.get_all_permissions())

    if getattr(user, 'is_staff', False):
        matrix['dashboard']['view'] = True

    for section, requirement in SECTION_PERMISSION_REQUIREMENTS.items():
        if section not in matrix:
            continue

        view_required = requirement.get('view') if isinstance(requirement, Mapping) else None
        change_required = requirement.get('change') if isinstance(requirement, Mapping) else None

        if view_required and _has_any_permission(permissions, view_required):
            matrix[section]['view'] = True

        if change_required and _has_any_permission(permissions, change_required):
            matrix[section]['change'] = True
            matrix[section]['view'] = True

    return matrix


__all__ = ['build_access_matrix', 'PermissionMatrix']

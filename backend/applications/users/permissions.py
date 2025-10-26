"""Helpers for serialising user permissions into a frontend-friendly shape."""

from __future__ import annotations


def _normalize_permission_code(permission_code: str) -> str:
    """Convert Django's ``app.codename`` to the ``section_action[_subject]`` format."""

    if '.' not in permission_code:
        return permission_code

    app_label, codename = permission_code.split('.', 1)
    action, _, subject = codename.partition('_')
    normalized_segments = [app_label, action]
    if subject:
        normalized_segments.append(subject)
    return '_'.join(normalized_segments)


def _ensure_view_permission(permission_code: str) -> set[str]:
    """Return a set with the original permission and implied dependencies."""

    normalized = _normalize_permission_code(permission_code)
    implied_permissions: set[str] = {normalized}

    if '.' not in permission_code:
        return implied_permissions

    app_label, codename = permission_code.split('.', 1)
    if codename.startswith('change_'):
        model_name = codename.removeprefix('change_')
        implied_permissions.add(_normalize_permission_code(f'{app_label}.view_{model_name}'))

    return implied_permissions


def serialize_user_permissions(user) -> list[str]:
    if not getattr(user, 'is_authenticated', False):
        return []

    permissions: set[str] = set()
    for permission_code in user.get_all_permissions():
        permissions.update(_ensure_view_permission(permission_code))

    return sorted(permissions)


__all__ = ['serialize_user_permissions']

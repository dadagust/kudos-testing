"""Grant logistics waybill access to staff roles."""

from __future__ import annotations

from django.db import migrations

ACTION_LABELS = {
    'view': 'Can view',
    'change': 'Can change',
}


ROLE_PERMISSION_REQUIREMENTS = {
    'SalesManager': (('adminpanel', 'logistics', 'view'),),
    'Warehouse': (('adminpanel', 'logistics', 'view'),),
    'Driver': (('adminpanel', 'logistics', 'view'),),
    'Loader': (('adminpanel', 'logistics', 'view'),),
    'Admin': (('adminpanel', 'logistics', 'view'), ('adminpanel', 'logistics', 'change')),
}


def ensure_waybill_permissions(apps, schema_editor):
    permission_model = apps.get_model('auth', 'Permission')
    content_type_model = apps.get_model('contenttypes', 'ContentType')
    group_model = apps.get_model('auth', 'Group')

    permissions_cache: dict[tuple[str, str], object] = {}

    for requirements in ROLE_PERMISSION_REQUIREMENTS.values():
        for app_label, model, action in requirements:
            key = (app_label, f'{action}_{model}')
            if key in permissions_cache:
                continue

            content_type, _ = content_type_model.objects.get_or_create(
                app_label=app_label,
                model=model,
            )
            verbose_model = model.replace('_', ' ')
            codename = f'{action}_{model}'
            label = ACTION_LABELS.get(action, action.title())
            name = f'{label} {verbose_model}'.strip()
            permission, _ = permission_model.objects.get_or_create(
                codename=codename,
                content_type=content_type,
                defaults={'name': name},
            )
            permissions_cache[key] = permission

    for group_name in ROLE_PERMISSION_REQUIREMENTS.keys():
        group_model.objects.get_or_create(name=group_name)

    for group_name, requirements in ROLE_PERMISSION_REQUIREMENTS.items():
        group = group_model.objects.get(name=group_name)
        permissions_to_add = []

        for app_label, model, action in requirements:
            key = (app_label, f'{action}_{model}')
            permission = permissions_cache.get(key)
            if permission is None:
                permission = permission_model.objects.filter(
                    codename=f'{action}_{model}',
                    content_type__app_label=app_label,
                ).first()
            if permission is not None:
                permissions_to_add.append(permission)

        if permissions_to_add:
            group.permissions.add(*permissions_to_add)


def revoke_waybill_permissions(apps, schema_editor):
    permission_model = apps.get_model('auth', 'Permission')
    group_model = apps.get_model('auth', 'Group')

    logistics_permissions = list(
        permission_model.objects.filter(
            codename__in={'view_logistics', 'change_logistics'},
            content_type__app_label='adminpanel',
        )
    )

    if not logistics_permissions:
        return

    for group_name in ROLE_PERMISSION_REQUIREMENTS.keys():
        group = group_model.objects.filter(name=group_name).first()
        if group is not None:
            group.permissions.remove(*logistics_permissions)


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0008_sync_logistics_permissions'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunPython(ensure_waybill_permissions, revoke_waybill_permissions),
    ]

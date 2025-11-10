from __future__ import annotations

from django.db import migrations


ACTION_LABELS = {
    'view': 'Can view',
    'change': 'Can change',
}


ROLE_PERMISSION_MATRIX = {
    'SalesManager': {('adminpanel', 'logistics'): ('view',)},
    'Warehouse': {('adminpanel', 'logistics'): ('view',)},
    'Driver': {('adminpanel', 'logistics'): ('view',)},
    'Loader': {('adminpanel', 'logistics'): ('view',)},
    'Admin': {('adminpanel', 'logistics'): ('view', 'change')},
}


def ensure_logistics_permissions(apps, schema_editor):
    permission_model = apps.get_model('auth', 'Permission')
    content_type_model = apps.get_model('contenttypes', 'ContentType')
    group_model = apps.get_model('auth', 'Group')

    content_type, _ = content_type_model.objects.get_or_create(
        app_label='adminpanel',
        model='logistics',
    )

    required_actions: set[str] = set()
    for permission_map in ROLE_PERMISSION_MATRIX.values():
        for _, actions in permission_map.items():
            required_actions.update(actions)

    permissions_by_action: dict[str, object] = {}

    for action in sorted(required_actions):
        codename = f'{action}_logistics'
        verbose_model = 'logistics'
        name = f"{ACTION_LABELS.get(action, action.title())} {verbose_model}".strip()
        permission, _ = permission_model.objects.update_or_create(
            codename=codename,
            content_type=content_type,
            defaults={'name': name},
        )
        permissions_by_action[action] = permission

    for group_name in ROLE_PERMISSION_MATRIX.keys():
        group_model.objects.get_or_create(name=group_name)

    for group_name, permission_map in ROLE_PERMISSION_MATRIX.items():
        group = group_model.objects.get(name=group_name)
        permissions_to_add = []

        for (app_label, model), actions in permission_map.items():
            for action in actions:
                permission = permissions_by_action.get(action)
                if permission is not None:
                    permissions_to_add.append(permission)

        if permissions_to_add:
            group.permissions.add(*permissions_to_add)


def remove_logistics_permissions(apps, schema_editor):
    permission_model = apps.get_model('auth', 'Permission')
    content_type_model = apps.get_model('contenttypes', 'ContentType')
    group_model = apps.get_model('auth', 'Group')

    content_type = content_type_model.objects.filter(
        app_label='adminpanel',
        model='logistics',
    ).first()

    if content_type is None:
        return

    permissions = list(
        permission_model.objects.filter(
            content_type=content_type,
            codename__in={f'{action}_logistics' for action in ACTION_LABELS.keys()},
        )
    )

    if permissions:
        for group_name in ROLE_PERMISSION_MATRIX.keys():
            group = group_model.objects.filter(name=group_name).first()
            if group is not None:
                group.permissions.remove(*permissions)

        permission_model.objects.filter(pk__in=[permission.pk for permission in permissions]).delete()

    content_type.delete()


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0007_alter_userprofile_role_alter_userprofile_user'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunPython(ensure_logistics_permissions, remove_logistics_permissions),
    ]

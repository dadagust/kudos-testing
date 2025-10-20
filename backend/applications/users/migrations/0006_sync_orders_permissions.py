from __future__ import annotations

from django.db import migrations

ACTION_LABELS = {
    'view': 'Can view',
    'add': 'Can add',
    'change': 'Can change',
    'delete': 'Can delete',
}


def ensure_permissions(apps, schema_editor):
    from applications.users.rbac import ROLE_PERMISSION_MATRIX, flatten_required_permissions

    permission_model = apps.get_model('auth', 'Permission')
    content_type_model = apps.get_model('contenttypes', 'ContentType')
    group_model = apps.get_model('auth', 'Group')

    required_permissions = flatten_required_permissions()
    for (app_label, model), actions in required_permissions.items():
        content_type, _ = content_type_model.objects.get_or_create(
            app_label=app_label,
            model=model,
        )
        verbose_model = model.replace('_', ' ')
        for action in sorted(actions):
            codename = f'{action}_{model}'
            label = ACTION_LABELS.get(action, action.title())
            name = f'{label} {verbose_model}'.strip()
            permission_model.objects.update_or_create(
                codename=codename,
                content_type=content_type,
                defaults={'name': name},
            )

    for group_name in ROLE_PERMISSION_MATRIX.keys():
        group_model.objects.get_or_create(name=group_name)

    for group_name, permission_map in ROLE_PERMISSION_MATRIX.items():
        group, _ = group_model.objects.get_or_create(name=group_name)
        if group_name == 'Admin':
            group.permissions.set(permission_model.objects.all())
            continue

        permissions = []
        for (app_label, model), actions in permission_map.items():
            for action in actions:
                codename = f'{action}_{model}'
                permission = permission_model.objects.filter(
                    codename=codename,
                    content_type__app_label=app_label,
                ).first()
                if permission is not None:
                    permissions.append(permission)
        group.permissions.set(permissions)


def noop(apps, schema_editor):  # pragma: no cover - rollback not required
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0005_update_role_permissions'),
        ('orders', '0001_initial'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunPython(ensure_permissions, noop),
    ]

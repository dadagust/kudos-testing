from django.db import migrations

ACTION_LABELS = {
    'view': 'Can view',
    'add': 'Can add',
    'change': 'Can change',
    'delete': 'Can delete',
}


def create_permissions(permission_model, content_type_model, required_permissions):
    created_permissions = {}
    for (app_label, model), actions in required_permissions.items():
        verbose_model = model.replace('_', ' ')
        content_type, _ = content_type_model.objects.get_or_create(
            app_label=app_label,
            model=model,
        )
        for action in sorted(actions):
            codename = f'{action}_{model}'
            label = ACTION_LABELS.get(action, action.title())
            name = f'{label} {verbose_model}'.strip()
            permission, _ = permission_model.objects.update_or_create(
                codename=codename,
                content_type=content_type,
                defaults={'name': name},
            )
            created_permissions[(app_label, codename)] = permission
    return created_permissions


def apply_group_permissions(group_model, permission_model, mapping):
    for group_name, permission_map in mapping.items():
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


def forwards(apps, schema_editor):
    from applications.users.rbac import (
        ROLE_GROUP_MAP,
        ROLE_PERMISSION_MATRIX,
        flatten_required_permissions,
    )

    group_model = apps.get_model('auth', 'Group')
    permission_model = apps.get_model('auth', 'Permission')
    content_type_model = apps.get_model('contenttypes', 'ContentType')

    required_permissions = flatten_required_permissions()
    create_permissions(permission_model, content_type_model, required_permissions)

    # ensure all groups exist
    for group_name in ROLE_GROUP_MAP.values():
        group_model.objects.get_or_create(name=group_name)

    apply_group_permissions(group_model, permission_model, ROLE_PERMISSION_MATRIX)


def backwards(apps, schema_editor):
    from applications.users.rbac import ROLE_PERMISSION_MATRIX

    group_model = apps.get_model('auth', 'Group')
    permission_model = apps.get_model('auth', 'Permission')
    content_type_model = apps.get_model('contenttypes', 'ContentType')

    for group_name, permission_map in ROLE_PERMISSION_MATRIX.items():
        group, _ = group_model.objects.get_or_create(name=group_name)
        if group_name == 'Admin':
            remaining_permissions = permission_model.objects.exclude(
                content_type__app_label='adminpanel'
            )
            group.permissions.set(remaining_permissions)
            continue

        permissions = []
        for (app_label, model), actions in permission_map.items():
            if app_label == 'adminpanel':
                continue
            for action in actions:
                codename = f'{action}_{model}'
                permission = permission_model.objects.filter(
                    codename=codename,
                    content_type__app_label=app_label,
                ).first()
                if permission is not None:
                    permissions.append(permission)
        group.permissions.set(permissions)

    permission_model.objects.filter(content_type__app_label='adminpanel').delete()
    content_type_model.objects.filter(app_label='adminpanel').delete()


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0004_alter_userprofile_options'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]

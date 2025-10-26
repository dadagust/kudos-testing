from collections import defaultdict

from django.db import migrations

ROLE_PERMISSION_MATRIX = {
    'Guest': {
        ('inventory', 'inventoryitem'): ('view',),
    },
    'Customer': {
        ('customers', 'customer'): ('view', 'change'),
        ('customers', 'company'): ('view', 'change'),
        ('customers', 'address'): ('view', 'change'),
        ('customers', 'contact'): ('view', 'change'),
        ('orders', 'order'): ('view',),
        ('inventory', 'inventoryitem'): ('view',),
        ('documents', 'document'): ('view',),
    },
    'B2B': {
        ('customers', 'customer'): ('view', 'change'),
        ('customers', 'company'): ('view', 'change'),
        ('customers', 'address'): ('view', 'change'),
        ('customers', 'contact'): ('view', 'change'),
        ('orders', 'order'): ('view',),
        ('inventory', 'inventoryitem'): ('view',),
        ('documents', 'document'): ('view',),
    },
    'SalesManager': {
        ('customers', 'customer'): ('view', 'add', 'change', 'delete'),
        ('customers', 'company'): ('view', 'change'),
        ('customers', 'address'): ('view', 'change'),
        ('customers', 'contact'): ('view', 'change'),
        ('orders', 'order'): ('view', 'add', 'change', 'delete'),
        ('inventory', 'inventoryitem'): ('view',),
        ('documents', 'document'): ('view',),
        ('adminpanel', 'dashboard'): ('view',),
        ('adminpanel', 'products'): ('view',),
        ('adminpanel', 'orders'): ('view',),
        ('adminpanel', 'customers'): ('view',),
        ('adminpanel', 'inventory'): ('view',),
        ('adminpanel', 'documents'): ('view',),
        ('adminpanel', 'logs'): ('view',),
    },
    'Warehouse': {
        ('customers', 'customer'): ('view',),
        ('customers', 'company'): ('view',),
        ('customers', 'address'): ('view',),
        ('customers', 'contact'): ('view',),
        ('orders', 'order'): ('view',),
        ('inventory', 'inventoryitem'): ('view', 'change'),
        ('documents', 'document'): ('view',),
        ('adminpanel', 'dashboard'): ('view',),
        ('adminpanel', 'orders'): ('view',),
        ('adminpanel', 'inventory'): ('view',),
        ('adminpanel', 'logs'): ('view',),
    },
    'Accountant': {
        ('customers', 'customer'): ('view',),
        ('customers', 'company'): ('view',),
        ('customers', 'address'): ('view',),
        ('customers', 'contact'): ('view',),
        ('orders', 'order'): ('view', 'change'),
        ('documents', 'document'): ('view', 'change'),
        ('adminpanel', 'dashboard'): ('view',),
        ('adminpanel', 'orders'): ('view',),
        ('adminpanel', 'customers'): ('view',),
        ('adminpanel', 'documents'): ('view',),
        ('adminpanel', 'logs'): ('view',),
    },
    'ContentManager': {
        ('inventory', 'inventoryitem'): ('view',),
        ('adminpanel', 'dashboard'): ('view',),
        ('adminpanel', 'products'): ('view',),
        ('adminpanel', 'documents'): ('view',),
    },
    'Driver': {
        ('customers', 'customer'): ('view',),
        ('orders', 'order'): ('view',),
        ('inventory', 'inventoryitem'): ('view',),
        ('adminpanel', 'dashboard'): ('view',),
        ('adminpanel', 'orders'): ('view',),
    },
    'Loader': {
        ('customers', 'customer'): ('view',),
        ('orders', 'order'): ('view',),
        ('inventory', 'inventoryitem'): ('view', 'change'),
        ('adminpanel', 'dashboard'): ('view',),
        ('adminpanel', 'orders'): ('view',),
        ('adminpanel', 'inventory'): ('view',),
    },
    'Admin': {
        ('adminpanel', 'dashboard'): ('view', 'change'),
        ('adminpanel', 'products'): ('view', 'change'),
        ('adminpanel', 'orders'): ('view', 'change'),
        ('adminpanel', 'customers'): ('view', 'change'),
        ('adminpanel', 'inventory'): ('view', 'change'),
        ('adminpanel', 'documents'): ('view', 'change'),
        ('adminpanel', 'integrations'): ('view', 'change'),
        ('adminpanel', 'settings'): ('view', 'change'),
        ('adminpanel', 'logs'): ('view', 'change'),
    },
}


def flatten_required_permissions() -> dict[tuple[str, str], set[str]]:
    accumulator: dict[tuple[str, str], set[str]] = defaultdict(set)
    for mapping in ROLE_PERMISSION_MATRIX.values():
        for (app_label, model), actions in mapping.items():
            accumulator[(app_label, model)].update(actions)
    return accumulator


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
    from applications.users.rbac import ROLE_GROUP_MAP

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

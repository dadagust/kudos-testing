from __future__ import annotations

from collections import defaultdict

from django.db import migrations

ACTION_LABELS = {
    'view': 'Can view',
    'add': 'Can add',
    'change': 'Can change',
    'delete': 'Can delete',
}


ROLE_PERMISSION_MATRIX = {
    'Guest': {
        ('inventory', 'inventoryitem'): ('view',),
        ('products', 'product'): ('view',),
        ('products', 'productimage'): ('view',),
        ('products', 'category'): ('view',),
    },
    'Customer': {
        ('customers', 'customer'): ('view', 'change'),
        ('customers', 'company'): ('view', 'change'),
        ('customers', 'address'): ('view', 'change'),
        ('customers', 'contact'): ('view', 'change'),
        ('orders', 'order'): ('view',),
        ('inventory', 'inventoryitem'): ('view',),
        ('documents', 'document'): ('view',),
        ('products', 'product'): ('view',),
        ('products', 'productimage'): ('view',),
        ('products', 'category'): ('view',),
    },
    'B2B': {
        ('customers', 'customer'): ('view', 'change'),
        ('customers', 'company'): ('view', 'change'),
        ('customers', 'address'): ('view', 'change'),
        ('customers', 'contact'): ('view', 'change'),
        ('orders', 'order'): ('view',),
        ('inventory', 'inventoryitem'): ('view',),
        ('documents', 'document'): ('view',),
        ('products', 'product'): ('view',),
        ('products', 'productimage'): ('view',),
        ('products', 'category'): ('view',),
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
        ('products', 'product'): ('view',),
        ('products', 'productimage'): ('view',),
        ('products', 'category'): ('view',),
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
        ('products', 'product'): ('view',),
        ('products', 'productimage'): ('view',),
        ('products', 'category'): ('view',),
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
        ('products', 'product'): ('view',),
        ('products', 'productimage'): ('view',),
        ('products', 'category'): ('view',),
    },
    'ContentManager': {
        ('inventory', 'inventoryitem'): ('view',),
        ('adminpanel', 'dashboard'): ('view',),
        ('adminpanel', 'products'): ('view',),
        ('adminpanel', 'documents'): ('view',),
        ('products', 'product'): ('view', 'add', 'change', 'delete'),
        ('products', 'productimage'): ('view', 'add', 'change', 'delete'),
        ('products', 'category'): ('view', 'add', 'change', 'delete'),
    },
    'Driver': {
        ('customers', 'customer'): ('view',),
        ('orders', 'order'): ('view',),
        ('inventory', 'inventoryitem'): ('view',),
        ('adminpanel', 'dashboard'): ('view',),
        ('adminpanel', 'orders'): ('view',),
        ('products', 'product'): ('view',),
        ('products', 'productimage'): ('view',),
        ('products', 'category'): ('view',),
    },
    'Loader': {
        ('customers', 'customer'): ('view',),
        ('orders', 'order'): ('view',),
        ('inventory', 'inventoryitem'): ('view', 'change'),
        ('adminpanel', 'dashboard'): ('view',),
        ('adminpanel', 'orders'): ('view',),
        ('adminpanel', 'inventory'): ('view',),
        ('products', 'product'): ('view',),
        ('products', 'productimage'): ('view',),
        ('products', 'category'): ('view',),
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
        ('products', 'product'): ('view', 'add', 'change', 'delete'),
        ('products', 'productimage'): ('view', 'add', 'change', 'delete'),
        ('products', 'category'): ('view', 'add', 'change', 'delete'),
    },
}


def flatten_required_permissions() -> dict[tuple[str, str], set[str]]:
    accumulator: dict[tuple[str, str], set[str]] = defaultdict(set)
    for mapping in ROLE_PERMISSION_MATRIX.values():
        for (app_label, model), actions in mapping.items():
            accumulator[(app_label, model)].update(actions)
    return accumulator


def ensure_permissions(apps, schema_editor):
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

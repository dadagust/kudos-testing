from __future__ import annotations

from django.apps import apps as global_apps
from django.contrib.auth.management import create_permissions
from django.db import migrations

from applications.core.rbac import ROLE_PERMISSION_MATRIX


def apply_order_permissions(apps, schema_editor):
    group_model = apps.get_model('auth', 'Group')
    permission_model = apps.get_model('auth', 'Permission')
    content_type_model = apps.get_model('contenttypes', 'ContentType')

    orders_config = global_apps.get_app_config('orders')
    create_permissions(orders_config, verbosity=0)

    content_type = content_type_model.objects.get(app_label='orders', model='order')

    for group_name, permission_map in ROLE_PERMISSION_MATRIX.items():
        group, _ = group_model.objects.get_or_create(name=group_name)
        allowed_actions = set(permission_map.get(('orders', 'order'), ()))
        desired_codenames = {f'{action}_order' for action in allowed_actions}

        existing_permissions = group.permissions.filter(content_type=content_type)
        for permission in existing_permissions:
            if permission.codename not in desired_codenames:
                group.permissions.remove(permission)

        permissions_to_add = permission_model.objects.filter(
            content_type=content_type, codename__in=desired_codenames
        )
        if permissions_to_add:
            group.permissions.add(*permissions_to_add)


def remove_order_permissions(apps, schema_editor):
    group_model = apps.get_model('auth', 'Group')
    permission_model = apps.get_model('auth', 'Permission')
    content_type_model = apps.get_model('contenttypes', 'ContentType')

    try:
        content_type = content_type_model.objects.get(app_label='orders', model='order')
    except content_type_model.DoesNotExist:
        return

    permissions = permission_model.objects.filter(content_type=content_type)
    for group in group_model.objects.all():
        group.permissions.remove(*permissions)


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0003_create_role_groups'),
        ('orders', '0001_initial'),
    ]

    operations = [migrations.RunPython(apply_order_permissions, remove_order_permissions)]

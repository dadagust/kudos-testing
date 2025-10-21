# Permission Maintenance Guide

## Baseline role-to-permission mapping

The data migration `applications.users.migrations.0005_update_role_permissions` provisions
all Django `auth.Permission` records we reference in the project and assigns them to
groups according to the `ROLE_PERMISSION_MATRIX` constant defined inside that migration.
Every time a fresh environment is migrated, migration 0005 rebuilds the default mapping.

> **API note:** the backend serialises granted permissions for the frontend as
> underscore-delimited strings (for example `adminpanel_view_dashboard` or
> `customers_change_customer`). Internally these values still come from standard
> Django permissions such as `adminpanel.view_dashboard` and
> `customers.change_customer` defined in migrations.

## Extending permissions with follow-up migrations

You can layer additional changes on top of that baseline with a new migration (for
example `0006_grant_loader_document_view`). In the migration you can fetch the target
`Group` records and attach extra `Permission` instances to them without touching the
matrix in code. Because Django runs migrations sequentially, the new migration will run
after 0005 on fresh environments, so the adjustments are preserved.

### When you do **not** need to touch the matrix

If the permission codename already exists (for example `adminpanel.view_documents` or
`documents.view_document` which are created by migration 0005), the follow-up migration
can simply add it to the desired group:

```python
from django.db import migrations


def grant_loader_document_view(apps, schema_editor):
    group_model = apps.get_model('auth', 'Group')
    permission_model = apps.get_model('auth', 'Permission')

    loader = group_model.objects.get(name='Loader')
    document_view = permission_model.objects.get(
        codename='view_documents',
        content_type__app_label='adminpanel',
    )
    loader.permissions.add(document_view)


def reverse(apps, schema_editor):
    group_model = apps.get_model('auth', 'Group')
    permission_model = apps.get_model('auth', 'Permission')

    loader = group_model.objects.get(name='Loader')
    document_view = permission_model.objects.get(
        codename='view_documents',
        content_type__app_label='adminpanel',
    )
    loader.permissions.remove(document_view)


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0005_update_role_permissions'),
    ]

    operations = [
        migrations.RunPython(grant_loader_document_view, reverse),
    ]
```

### When you **do** need to touch the matrix

If you introduce a brand-new permission (for example a new admin panel section with its
own content type), you must update `ROLE_PERMISSION_MATRIX` in the relevant migration so
it knows to create the underlying `auth.Permission` objects. Otherwise the follow-up
migration will fail to find the permission codename to attach.

Updating the matrix keeps the declarative baseline in sync with reality while allowing
incremental adjustments through additional migrations.

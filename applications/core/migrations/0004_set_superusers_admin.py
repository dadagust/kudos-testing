from django.db import migrations


def promote_superusers_to_admin(apps, schema_editor):
    UserProfile = apps.get_model('core', 'UserProfile')

    UserProfile.objects.filter(user__is_superuser=True).update(role='admin')


def revert_superusers_roles(apps, schema_editor):
    # Ничего не делаем при откате — суперпользователь может вручную выбрать нужную роль.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_create_role_groups'),
    ]

    operations = [
        migrations.RunPython(promote_superusers_to_admin, revert_superusers_roles),
    ]

from django.db import migrations, models
from django.db.models import Q
from django.db.models.functions import Lower


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0001_initial'),
    ]

    operations = [
        migrations.RenameField(
            model_name='company',
            old_name='created_at',
            new_name='created',
        ),
        migrations.RenameField(
            model_name='company',
            old_name='updated_at',
            new_name='modified',
        ),
        migrations.AlterModelOptions(
            name='company',
            options={
                'indexes': [
                    models.Index(fields=('name',), name='company_name_idx'),
                    models.Index(fields=('inn',), name='company_inn_idx'),
                ],
                'ordering': ['-created'],
                'verbose_name': 'Компания',
                'verbose_name_plural': 'Компании',
            },
        ),
        migrations.RenameField(
            model_name='contact',
            old_name='created_at',
            new_name='created',
        ),
        migrations.RenameField(
            model_name='contact',
            old_name='updated_at',
            new_name='modified',
        ),
        migrations.AlterModelOptions(
            name='contact',
            options={
                'indexes': [
                    models.Index(fields=('customer',), name='contact_customer_idx'),
                    models.Index(fields=('company',), name='contact_company_idx'),
                    models.Index(fields=('phone_normalized',), name='contact_phone_idx'),
                ],
                'ordering': ['-created'],
                'verbose_name': 'Контакт',
                'verbose_name_plural': 'Контакты',
            },
        ),
        migrations.RenameField(
            model_name='customer',
            old_name='created_at',
            new_name='created',
        ),
        migrations.RenameField(
            model_name='customer',
            old_name='updated_at',
            new_name='modified',
        ),
        migrations.AlterModelOptions(
            name='customer',
            options={
                'constraints': [
                    models.UniqueConstraint(
                        Lower('email'),
                        condition=Q(email__gt=''),
                        name='customers_customer_email_ci_unique',
                    ),
                    models.UniqueConstraint(
                        fields=('phone_normalized',),
                        condition=Q(phone_normalized__gt=''),
                        name='customers_customer_phone_unique',
                    ),
                ],
                'indexes': [
                    models.Index(fields=('customer_type',), name='customer_type_idx'),
                    models.Index(fields=('email',), name='customer_email_idx'),
                    models.Index(fields=('phone_normalized',), name='customer_phone_idx'),
                    models.Index(fields=('owner',), name='customer_owner_idx'),
                ],
                'ordering': ['-created'],
                'verbose_name': 'Клиент',
                'verbose_name_plural': 'Клиенты',
            },
        ),
    ]

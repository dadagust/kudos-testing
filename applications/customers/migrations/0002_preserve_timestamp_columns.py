from django.db import migrations


def _rename_column_if_exists(schema_editor, table_name, source, target):
    connection = schema_editor.connection
    introspection = connection.introspection
    with connection.cursor() as cursor:
        existing_columns = {column.name for column in introspection.get_table_description(cursor, table_name)}
    if source in existing_columns and target not in existing_columns:
        schema_editor.execute(
            'ALTER TABLE {table} RENAME COLUMN {source} TO {target};'.format(
                table=schema_editor.quote_name(table_name),
                source=schema_editor.quote_name(source),
                target=schema_editor.quote_name(target),
            )
        )


def ensure_legacy_timestamp_names(apps, schema_editor):
    mappings = (
        ('customers_company', 'created_at', 'created'),
        ('customers_company', 'updated_at', 'modified'),
        ('customers_contact', 'created_at', 'created'),
        ('customers_contact', 'updated_at', 'modified'),
        ('customers_customer', 'created_at', 'created'),
        ('customers_customer', 'updated_at', 'modified'),
    )
    for table, source, target in mappings:
        _rename_column_if_exists(schema_editor, table, source, target)


def restore_modern_timestamp_names(apps, schema_editor):
    mappings = (
        ('customers_company', 'created', 'created_at'),
        ('customers_company', 'modified', 'updated_at'),
        ('customers_contact', 'created', 'created_at'),
        ('customers_contact', 'modified', 'updated_at'),
        ('customers_customer', 'created', 'created_at'),
        ('customers_customer', 'modified', 'updated_at'),
    )
    for table, source, target in mappings:
        _rename_column_if_exists(schema_editor, table, source, target)


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(ensure_legacy_timestamp_names, restore_modern_timestamp_names),
    ]

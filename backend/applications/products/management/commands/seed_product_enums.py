from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction

from applications.products.models import Color, TransportRestriction

COLORS: tuple[tuple[str, str], ...] = (
    ('white', 'Белый'),
    ('gray', 'Серый'),
    ('black', 'Чёрный'),
    ('red', 'Красный'),
    ('orange', 'Оранжевый'),
    ('brown', 'Коричневый'),
    ('yellow', 'Жёлтый'),
    ('green', 'Зелёный'),
    ('turquoise', 'Бирюзовый'),
    ('blue', 'Синий'),
    ('violet', 'Фиолетовый'),
)

TRANSPORT_RESTRICTIONS: tuple[tuple[str, str], ...] = (
    ('any', 'Любой'),
    ('truck_only', 'Только грузовой'),
    ('heavy_only', 'Только большегрузный'),
    ('heavy16_only', 'Только «Большегрузный 16+»'),
    ('special2_only', 'Только «Особый 2»'),
)


class Command(BaseCommand):
    help = 'Создаёт (или обновляет) значения справочников цветов и ограничений транспорта.'

    def handle(self, *args, **options):
        created, updated = 0, 0

        with transaction.atomic():
            for value, label in COLORS:
                obj, was_created = Color.objects.update_or_create(
                    value=value,
                    defaults={'label': label},
                )
                if was_created:
                    created += 1
                    self.stdout.write(self.style.SUCCESS(f'Создан цвет: {obj.label}'))
                else:
                    updated += 1
                    self.stdout.write(
                        self.style.NOTICE(f'Обновлён цвет: {obj.label} (значение: {obj.value})')
                    )

            for value, label in TRANSPORT_RESTRICTIONS:
                obj, was_created = TransportRestriction.objects.update_or_create(
                    value=value,
                    defaults={'label': label},
                )
                if was_created:
                    created += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'Создано ограничение по транспорту: {obj.label}')
                    )
                else:
                    updated += 1
                    self.stdout.write(
                        self.style.NOTICE(
                            'Обновлено ограничение по транспорту: '
                            f'{obj.label} (значение: {obj.value})'
                        )
                    )

        self.stdout.write(self.style.SUCCESS(f'Готово. Создано: {created}, обновлено: {updated}.'))

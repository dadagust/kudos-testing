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

TRANSPORT_RESTRICTIONS: tuple[dict[str, str | int], ...] = (
    {
        'value': 'any',
        'label': 'Любой',
        'capacity_volume_cm3': 750_000,
        'cost_per_km_rub': '45.00',
        'cost_per_transport_rub': '1500.00',
    },
    {
        'value': 'truck_only',
        'label': 'Только грузовой',
        'capacity_volume_cm3': 1_500_000,
        'cost_per_km_rub': '65.00',
        'cost_per_transport_rub': '2500.00',
    },
    {
        'value': 'heavy_only',
        'label': 'Только большегрузный',
        'capacity_volume_cm3': 2_400_000,
        'cost_per_km_rub': '80.00',
        'cost_per_transport_rub': '3200.00',
    },
    {
        'value': 'heavy16_only',
        'label': 'Только «Большегрузный 16+»',
        'capacity_volume_cm3': 3_200_000,
        'cost_per_km_rub': '110.00',
        'cost_per_transport_rub': '4500.00',
    },
    {
        'value': 'special2_only',
        'label': 'Только «Особый 2»',
        'capacity_volume_cm3': 4_200_000,
        'cost_per_km_rub': '140.00',
        'cost_per_transport_rub': '6000.00',
    },
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

            for restriction in TRANSPORT_RESTRICTIONS:
                obj, was_created = TransportRestriction.objects.update_or_create(
                    value=restriction['value'],
                    defaults={
                        'label': restriction['label'],
                        'capacity_volume_cm3': restriction['capacity_volume_cm3'],
                        'cost_per_km_rub': restriction['cost_per_km_rub'],
                        'cost_per_transport_rub': restriction['cost_per_transport_rub'],
                    },
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

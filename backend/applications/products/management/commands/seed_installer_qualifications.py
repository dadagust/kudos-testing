from __future__ import annotations

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from applications.products.models import InstallerQualification

QUALIFICATIONS: tuple[dict[str, Decimal], ...] = (
    {
        'name': 'Любой',
        'price_rub': Decimal('0.00'),
        'minimal_price_rub': Decimal('0.00'),
        'hour_price_rub': Decimal('0.00'),
    },
    {
        'name': 'Сотрудник с парогенератором',
        'price_rub': Decimal('1000.00'),
        'minimal_price_rub': Decimal('1000.00'),
        'hour_price_rub': Decimal('1000.00'),
    },
)


class Command(BaseCommand):
    help = 'Создаёт (или обновляет) базовые квалификации монтажников.'

    def handle(self, *args, **options):
        created, updated = 0, 0

        with transaction.atomic():
            for entry in QUALIFICATIONS:
                name = entry['name']
                obj, was_created = InstallerQualification.objects.update_or_create(
                    name=name,
                    defaults={
                        'price_rub': entry['price_rub'],
                        'minimal_price_rub': entry['minimal_price_rub'],
                        'hour_price_rub': entry['hour_price_rub'],
                    },
                )
                if was_created:
                    created += 1
                    self.stdout.write(self.style.SUCCESS(f'Создана квалификация: {obj.name}'))
                else:
                    updated += 1
                    self.stdout.write(
                        self.style.NOTICE(
                            (
                                'Обновлена квалификация: '
                                f"{obj.name} (стоимость: {obj.price_rub},"
                                f" минимум: {obj.minimal_price_rub},"
                                f" часовая ставка: {obj.hour_price_rub})"
                            )
                        )
                    )

        self.stdout.write(self.style.SUCCESS(f'Готово. Создано: {created}, обновлено: {updated}.'))

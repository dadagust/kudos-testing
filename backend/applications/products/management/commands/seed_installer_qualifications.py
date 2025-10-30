from __future__ import annotations

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from applications.products.models import InstallerQualification

QUALIFICATIONS: tuple[tuple[str, Decimal], ...] = (
    ('Любой', Decimal('0.00')),
    ('Сотрудник с парогенератором', Decimal('1000.00')),
)


class Command(BaseCommand):
    help = 'Создаёт (или обновляет) базовые квалификации монтажников.'

    def handle(self, *args, **options):
        created, updated = 0, 0

        with transaction.atomic():
            for name, price in QUALIFICATIONS:
                obj, was_created = InstallerQualification.objects.update_or_create(
                    name=name,
                    defaults={'price_rub': price},
                )
                if was_created:
                    created += 1
                    self.stdout.write(self.style.SUCCESS(f'Создана квалификация: {obj.name}'))
                else:
                    updated += 1
                    self.stdout.write(
                        self.style.NOTICE(
                            f'Обновлена квалификация: {obj.name} (стоимость: {obj.price_rub})'
                        )
                    )

        self.stdout.write(self.style.SUCCESS(f'Готово. Создано: {created}, обновлено: {updated}.'))

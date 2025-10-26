from __future__ import annotations

from typing import Iterable, Mapping, Optional
from dataclasses import dataclass

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from applications.products.models import Category


@dataclass(frozen=True)
class Node:
    name: str
    children: tuple["Node", ...] = ()


def make_slug(name: str) -> str:
    return slugify(name, allow_unicode=False)

CATEGORIES: tuple[Node, ...] = (
    Node("Мебель"),
    Node("Посуда", children=(
        Node("Бокалы"),
        Node("Подстановочные тарелки"),
        Node("Сервисные тарелки"),
    )),
    Node("Скатерти круглые"),
    Node("Скатерти прямоугольные"),
    Node("Салфетка"),
    Node("Освещение"),
    Node("Указатели"),
    Node("Аксессуары"),
)


class Command(BaseCommand):
    help = "Создаёт (или обновляет) иерархию категорий для прайс-листа."

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Перед созданием удалить ВСЕ существующие категории.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Показать, что будет создано, не внося изменений.",
        )

    def handle(self, *args, **options):
        dry = options["dry_run"]
        flush = options["flush"]

        if dry:
            self.stdout.write(self.style.WARNING("DRY-RUN: изменения не будут сохранены."))

        with transaction.atomic():
            if flush:
                if dry:
                    self.stdout.write(self.style.WARNING("DRY-RUN: Category.objects.all().delete()"))
                else:
                    Category.objects.all().delete()
                    self.stdout.write(self.style.SUCCESS("Очищены все категории."))

            created, existed = 0, 0

            def upsert(node: Node, parent: Optional[Category] = None):
                nonlocal created, existed
                slug = make_slug(node.name)
                defaults = {"name": node.name, "parent": parent}
                if dry:
                    self.stdout.write(f"[DRY] ensure Category(name='{node.name}', slug='{slug}', parent={parent})")
                    obj = None  # не создаём детей реально, только выводим
                else:
                    obj, was_created = Category.objects.update_or_create(
                        slug=slug,
                        defaults=defaults,
                    )
                    if was_created:
                        created += 1
                        self.stdout.write(self.style.SUCCESS(f"Создана категория: {obj.name}"))
                    else:
                        existed += 1
                        # на случай, если имя/parent поменяли в структуре
                        if obj.name != node.name or obj.parent_id != (parent.id if parent else None):
                            obj.name = node.name
                            obj.parent = parent
                            obj.save(update_fields=["name", "parent"])
                            self.stdout.write(self.style.NOTICE(f"Обновлена категория: {obj.name}"))
                # рекурсивно дети
                for child in node.children:
                    upsert(child, parent=obj if not dry else parent)

            for top in CATEGORIES:
                upsert(top, None)

            if dry:
                self.stdout.write(self.style.WARNING("DRY-RUN завершён."))
            else:
                self.stdout.write(self.style.SUCCESS(f"Готово. Создано: {created}, существовало: {existed}."))

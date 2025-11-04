# applications/products/management/commands/sync_stock_qty.py
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import F

from applications.products.models import Product


class Command(BaseCommand):
    help = (
        "Приравнять stock_qty к available_stock_qty для всех товаров. "
        "Использует один UPDATE-запрос и не вызывает save()/валидаторы."
    )

    def handle(self, *args, **options):
        qs = Product.objects.all()
        for product in qs:
            product.available_stock_qty = product.stock_qty
            product.save()
            print(f"{product.name} {product.stock_qty} {product.available_stock_qty}")

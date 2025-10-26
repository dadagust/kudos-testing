"""Application configuration for products domain."""

from django.apps import AppConfig


class ProductsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'applications.products'
    verbose_name = 'Products'

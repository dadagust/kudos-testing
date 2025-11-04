"""Application configuration for products domain."""

from django.apps import AppConfig


class ProductsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'applications.products'
    verbose_name = 'Products'

    def ready(self):  # pragma: no cover - side effect wiring
        from . import signals  # noqa: F401

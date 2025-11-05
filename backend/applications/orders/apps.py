from django.apps import AppConfig


class OrdersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'applications.orders'
    label = 'orders'

    def ready(self) -> None:  # pragma: no cover - Django hook
        from . import signals  # noqa: F401

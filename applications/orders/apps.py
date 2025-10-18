"""Application configuration for orders domain."""

from django.apps import AppConfig


class OrdersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'applications.orders'
    verbose_name = 'Orders'


__all__ = ['OrdersConfig']

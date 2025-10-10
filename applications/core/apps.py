from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'applications.core'

    def ready(self):
        from django.apps import apps as django_apps

        from auditlog.registry import auditlog

        for model in django_apps.get_models():
            if model.__module__.startswith('applications.'):
                auditlog.register(model)

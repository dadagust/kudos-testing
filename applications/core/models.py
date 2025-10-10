from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models
from django.db.utils import DatabaseError, OperationalError, ProgrammingError
from django.db.models.signals import post_save
from django.dispatch import receiver


class RoleChoices(models.TextChoices):
    GUEST = 'guest', 'Гость'
    CUSTOMER = 'customer', 'Клиент'
    B2B = 'b2b', 'B2B Клиент'
    SALES_MANAGER = 'sales_manager', 'Менеджер продаж'
    WAREHOUSE = 'warehouse', 'Склад'
    ACCOUNTANT = 'accountant', 'Бухгалтерия'
    CONTENT_MANAGER = 'content_manager', 'Контент-менеджер'
    ADMIN = 'admin', 'Администратор'
    DRIVER = 'driver', 'Водитель'
    LOADER = 'loader', 'Грузчик'


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile'
    )
    role = models.CharField(max_length=32, choices=RoleChoices.choices, default=RoleChoices.SALES_MANAGER)

    def __str__(self) -> str:  # pragma: no cover - human readable
        return f'{self.user.get_full_name() or self.user.email} ({self.get_role_display()})'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.sync_role_membership()

    def sync_role_membership(self) -> None:
        from django.contrib.auth.models import Group

        from .rbac import ROLE_GROUP_MAP, STAFF_ROLE_CODES

        try:
            group_name = ROLE_GROUP_MAP.get(self.role)
            if group_name:
                group, _ = Group.objects.get_or_create(name=group_name)
                role_group_names = set(ROLE_GROUP_MAP.values())
                extra_groups = self.user.groups.exclude(name=group_name).filter(name__in=role_group_names)
                if extra_groups.exists():
                    self.user.groups.remove(*extra_groups)
                if not self.user.groups.filter(pk=group.pk).exists():
                    self.user.groups.add(group)

            expected_staff = self.role in STAFF_ROLE_CODES
            if self.user.is_staff != expected_staff:
                self.user.is_staff = expected_staff
                self.user.save(update_fields=['is_staff'])
        except (OperationalError, ProgrammingError, DatabaseError):
            # База еще не инициализирована (например, до применения миграций).
            # В этом случае просто пропускаем синхронизацию, она выполнится при следующем сохранении.
            return


User = get_user_model()


@receiver(post_save, sender=User)
def ensure_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)

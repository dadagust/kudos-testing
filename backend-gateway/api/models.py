from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class RoleChoices(models.TextChoices):
    GUEST = "guest", "Гость"
    CLIENT = "client", "Клиент"
    B2B = "b2b", "B2B Клиент"
    MANAGER = "manager", "Менеджер"
    WAREHOUSE = "warehouse", "Склад"
    ACCOUNTANT = "accountant", "Бухгалтерия"
    CONTENT_MANAGER = "content_manager", "Контент-менеджер"
    ADMINISTRATOR = "administrator", "Администратор"


class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=32, choices=RoleChoices.choices, default=RoleChoices.MANAGER)

    def __str__(self) -> str:  # pragma: no cover - human readable
        return f"{self.user.get_full_name() or self.user.email} ({self.get_role_display()})"


User = get_user_model()


@receiver(post_save, sender=User)
def ensure_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)

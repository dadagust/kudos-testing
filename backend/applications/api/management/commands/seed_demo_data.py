from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from applications.api.models import RoleChoices, UserProfile


class Command(BaseCommand):
    help = 'Создает демонстрационных пользователей и роли для первых экранов'

    DEMO_USERS = [
        ('guest@kudos.ru', 'Гость', RoleChoices.GUEST),
        ('client@kudos.ru', 'Клиент', RoleChoices.CLIENT),
        ('b2b@kudos.ru', 'B2B Клиент', RoleChoices.B2B),
        ('manager@kudos.ru', 'Ирина', RoleChoices.MANAGER),
        ('warehouse@kudos.ru', 'Склад', RoleChoices.WAREHOUSE),
        ('accountant@kudos.ru', 'Бухгалтерия', RoleChoices.ACCOUNTANT),
        ('content@kudos.ru', 'Контент', RoleChoices.CONTENT_MANAGER),
        ('admin@kudos.ru', 'Администратор', RoleChoices.ADMINISTRATOR),
    ]

    def handle(self, *args, **options):
        user_model = get_user_model()
        default_password = options.get('password') or 'ChangeMe123!'

        created_count = 0
        for email, name, role in self.DEMO_USERS:
            user, created = user_model.objects.update_or_create(
                email=email,
                defaults={
                    'username': email,
                    'first_name': name,
                },
            )
            if created:
                user.set_password(default_password)
                user.save()
                created_count += 1

            profile, _ = UserProfile.objects.get_or_create(user=user)
            if profile.role != role:
                profile.role = role
                profile.save()

        self.stdout.write(
            self.style.SUCCESS(
                f'Данные готовы. Пользователи: {len(self.DEMO_USERS)}, новых создано: {created_count}. Пароль: {default_password}'
            )
        )

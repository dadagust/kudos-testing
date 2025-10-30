"""Data models for customer management domain."""

from __future__ import annotations

import secrets
import time
import uuid
from collections.abc import Iterable

from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

from applications.core.models import Date


def generate_uuid7() -> uuid.UUID:
    """Generate a time-ordered UUIDv7 compatible identifier."""

    timestamp = int(time.time_ns() // 1_000_000)
    timestamp &= (1 << 48) - 1
    rand_a = secrets.randbits(12)
    rand_b = secrets.randbits(62)
    msb = (timestamp << 16) | (0x7 << 12) | rand_a
    lsb = (0b10 << 62) | rand_b
    return uuid.UUID(int=(msb << 64) | lsb)


class CustomerBaseModel(Date):
    """Abstract base model for customer domain entities."""

    id = models.UUIDField(
        primary_key=True,
        default=generate_uuid7,
        editable=False,
    )
    is_active = models.BooleanField(
        default=True,
    )

    class Meta(Date.Meta):
        abstract = True


class Company(CustomerBaseModel):
    """Legal entity related to one or many customers."""

    name = models.CharField(
        verbose_name='Название компании',
        max_length=255,
    )
    legal_name = models.CharField(
        verbose_name='Юридическое название',
        max_length=255,
        blank=True,
    )
    inn = models.CharField(
        verbose_name='ИНН',
        max_length=12,
        blank=True,
    )
    kpp = models.CharField(
        verbose_name='КПП',
        max_length=9,
        blank=True,
    )
    ogrn = models.CharField(
        verbose_name='ОГРН',
        max_length=13,
        blank=True,
    )
    email = models.EmailField(
        verbose_name='Email',
        blank=True,
    )
    phone = models.CharField(
        verbose_name='Телефон',
        max_length=32,
        blank=True,
    )
    website = models.URLField(
        verbose_name='Сайт',
        blank=True,
    )
    notes = models.TextField(
        verbose_name='Заметки',
        blank=True,
    )

    class Meta(CustomerBaseModel.Meta):
        verbose_name = 'Компания'
        verbose_name_plural = 'Компании'
        indexes = [
            models.Index(
                fields=('name',),
                name='company_name_idx',
            ),
            models.Index(
                fields=('inn',),
                name='company_inn_idx',
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable representation
        return self.name


class CustomerType(models.TextChoices):
    PERSONAL = 'personal', 'Физическое лицо'
    BUSINESS = 'business', 'Юридическое лицо'


class CustomerQuerySet(models.QuerySet):
    def active(self) -> CustomerQuerySet:
        return self.filter(is_active=True)

    def for_user(self, user) -> CustomerQuerySet:
        if not getattr(user, 'is_authenticated', False):
            return self.none()

        if user.is_staff:
            return self

        if user.has_perm('customers.view_customer'):
            return self.filter(owner=user)

        return self.none()


class Customer(CustomerBaseModel):
    """Customer profile that might be linked with a company and contacts."""

    owner = models.ForeignKey(
        to=settings.AUTH_USER_MODEL,
        verbose_name='Ответственный менеджер',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customers',
    )
    customer_type = models.CharField(
        verbose_name='Тип клиента',
        max_length=16,
        choices=CustomerType.choices,
        default=CustomerType.PERSONAL,
    )
    first_name = models.CharField(
        verbose_name='Имя',
        max_length=120,
        blank=True,
    )
    last_name = models.CharField(
        verbose_name='Фамилия',
        max_length=120,
        blank=True,
    )
    middle_name = models.CharField(
        verbose_name='Отчество',
        max_length=120,
        blank=True,
    )
    display_name = models.CharField(
        verbose_name='Отображаемое имя',
        max_length=255,
        blank=True,
    )
    email = models.EmailField(
        verbose_name='Email',
        blank=True,
    )
    phone = models.CharField(
        verbose_name='Телефон',
        max_length=32,
        blank=True,
    )
    phone_normalized = models.CharField(
        verbose_name='Нормализованный телефон',
        max_length=32,
        blank=True,
        help_text='Используется для поиска и уникальности',
    )
    gdpr_consent = models.BooleanField(
        verbose_name='Согласие на обработку данных',
        default=False,
    )
    company = models.ForeignKey(
        to=Company,
        verbose_name='Компания',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customers',
    )
    notes = models.TextField(
        verbose_name='Заметки',
        blank=True,
    )

    objects = CustomerQuerySet.as_manager()

    class Meta(CustomerBaseModel.Meta):
        verbose_name = 'Клиент'
        verbose_name_plural = 'Клиенты'
        constraints = [
            models.UniqueConstraint(
                Lower('email'),
                condition=Q(email__gt=''),
                name='customers_customer_email_ci_unique',
            ),
            models.UniqueConstraint(
                fields=('phone_normalized',),
                condition=Q(phone_normalized__gt=''),
                name='customers_customer_phone_unique',
            ),
        ]
        indexes = [
            models.Index(
                fields=('customer_type',),
                name='customer_type_idx',
            ),
            models.Index(
                fields=('email',),
                name='customer_email_idx',
            ),
            models.Index(
                fields=('phone_normalized',),
                name='customer_phone_idx',
            ),
            models.Index(
                fields=('owner',),
                name='customer_owner_idx',
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable
        return self.full_name or self.email or str(self.pk)

    @property
    def full_name(self) -> str:
        if self.display_name:
            return self.display_name
        parts: Iterable[str] = filter(None, [self.last_name, self.first_name, self.middle_name])
        return ' '.join(parts)

    def sync_display_name(self) -> None:
        if not self.display_name:
            self.display_name = self.full_name

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.lower().strip()
        if self.phone:
            normalized = PhoneNormalizer.normalize(self.phone)
            self.phone_normalized = normalized
        self.sync_display_name()
        super().save(*args, **kwargs)


class Contact(CustomerBaseModel):
    """Additional contact person for a customer or company."""

    customer = models.ForeignKey(
        to=Customer,
        verbose_name='Клиент',
        on_delete=models.CASCADE,
        related_name='contacts',
    )
    company = models.ForeignKey(
        to=Company,
        verbose_name='Компания',
        on_delete=models.CASCADE,
        related_name='contacts',
        null=True,
        blank=True,
    )
    first_name = models.CharField(
        verbose_name='Имя',
        max_length=120,
    )
    last_name = models.CharField(
        verbose_name='Фамилия',
        max_length=120,
        blank=True,
    )
    email = models.EmailField(
        verbose_name='Email',
        blank=True,
    )
    phone = models.CharField(
        verbose_name='Телефон',
        max_length=32,
        blank=True,
    )
    phone_normalized = models.CharField(
        verbose_name='Нормализованный телефон',
        max_length=32,
        blank=True,
    )
    position = models.CharField(
        verbose_name='Должность',
        max_length=120,
        blank=True,
    )
    notes = models.TextField(
        verbose_name='Заметки',
        blank=True,
    )
    is_primary = models.BooleanField(
        verbose_name='Основной контакт',
        default=False,
    )

    phone_validator = RegexValidator(
        r'^[0-9+()\-\s]*$',
        'Некорректный формат номера телефона',
    )

    class Meta(CustomerBaseModel.Meta):
        verbose_name = 'Контакт'
        verbose_name_plural = 'Контакты'
        indexes = [
            models.Index(
                fields=('customer',),
                name='contact_customer_idx',
            ),
            models.Index(
                fields=('company',),
                name='contact_company_idx',
            ),
            models.Index(
                fields=('phone_normalized',),
                name='contact_phone_idx',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.first_name} {self.last_name}'.strip()

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.lower().strip()
        if self.phone:
            self.phone_validator(self.phone)
            self.phone_normalized = PhoneNormalizer.normalize(self.phone)
        super().save(*args, **kwargs)


class PhoneNormalizer:
    """Utility helper for cleaning phone numbers."""

    @staticmethod
    def normalize(value: str) -> str:
        digits = ''.join(ch for ch in value if ch.isdigit())
        if not digits:
            return ''
        normalized = digits
        if normalized.startswith('8') and len(normalized) == 11:
            normalized = '7' + normalized[1:]
        if not normalized.startswith('7') and len(normalized) == 10:
            normalized = '7' + normalized
        if not normalized.startswith('7') and len(normalized) > 11:
            return f'+{normalized}'
        return f'+{normalized}'

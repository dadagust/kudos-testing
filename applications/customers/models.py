from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class TimeStampedQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    objects = TimeStampedQuerySet.as_manager()

    class Meta:
        abstract = True

    def deactivate(self):
        self.is_active = False
        self.save(update_fields=['is_active'])


class Company(TimeStampedModel):
    name = models.CharField(max_length=255)
    legal_name = models.CharField(max_length=255, blank=True)
    inn = models.CharField('ИНН', max_length=12, blank=True)
    kpp = models.CharField('КПП', max_length=9, blank=True)
    ogrn = models.CharField('ОГРН', max_length=15, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    website = models.URLField(blank=True)
    notes = models.TextField(blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='companies',
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ['name']
        verbose_name = 'Компания'
        verbose_name_plural = 'Компании'
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['inn']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable
        return self.name


class CustomerType(models.TextChoices):
    INDIVIDUAL = 'individual', 'Физическое лицо'
    CORPORATE = 'corporate', 'Юридическое лицо'


class Customer(TimeStampedModel):
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    middle_name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=32, unique=True)
    tags = models.JSONField(default=list, blank=True)
    gdpr_consent = models.BooleanField(default=False)
    marketing_consent = models.BooleanField(default=False)
    customer_type = models.CharField(
        max_length=32, choices=CustomerType.choices, default=CustomerType.INDIVIDUAL
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='customers',
        null=True,
        blank=True,
    )
    company = models.ForeignKey(
        Company, on_delete=models.SET_NULL, related_name='customers', null=True, blank=True
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Клиент'
        verbose_name_plural = 'Клиенты'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['phone']),
            models.Index(fields=['customer_type']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable
        return self.full_name or self.email

    @property
    def full_name(self) -> str:
        parts = [self.last_name, self.first_name, self.middle_name]
        return ' '.join(part for part in parts if part).strip()

    def deactivate(self):
        super().deactivate()
        self.contacts.update(is_active=False)
        self.addresses.update(is_active=False)


class AddressType(models.TextChoices):
    SHIPPING = 'shipping', 'Доставка'
    BILLING = 'billing', 'Юридический'
    OTHER = 'other', 'Дополнительный'


class Address(TimeStampedModel):
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name='addresses', null=True, blank=True
    )
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name='addresses', null=True, blank=True
    )
    title = models.CharField(max_length=150, blank=True)
    address_type = models.CharField(
        max_length=32, choices=AddressType.choices, default=AddressType.SHIPPING
    )
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=120, blank=True)
    region = models.CharField(max_length=120, blank=True)
    city = models.CharField(max_length=120, blank=True)
    street = models.CharField(max_length=255, blank=True)
    building = models.CharField(max_length=120, blank=True)
    apartment = models.CharField(max_length=120, blank=True)
    comment = models.TextField(blank=True)
    is_primary = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Адрес'
        verbose_name_plural = 'Адреса'
        indexes = [
            models.Index(fields=['customer']),
            models.Index(fields=['company']),
            models.Index(fields=['address_type']),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable
        return self.display

    @property
    def display(self) -> str:
        parts = [self.city, self.street, self.building, self.apartment]
        return ', '.join(part for part in parts if part)

    def clean(self):
        super().clean()
        if not self.customer and not self.company:
            raise ValidationError('Адрес должен принадлежать клиенту или компании')

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class Contact(TimeStampedModel):
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name='contacts', null=True, blank=True
    )
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name='contacts', null=True, blank=True
    )
    name = models.CharField(max_length=255)
    position = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    notes = models.TextField(blank=True)
    is_primary = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Контакт'
        verbose_name_plural = 'Контакты'
        indexes = [
            models.Index(fields=['customer']),
            models.Index(fields=['company']),
            models.Index(fields=['is_primary']),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable
        return self.name

    def clean(self):
        super().clean()
        if not self.customer and not self.company:
            raise ValidationError('Контакт должен принадлежать клиенту или компании')

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

from __future__ import annotations

import re
from typing import Any

from django.db import IntegrityError, transaction
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import Address, Company, Contact, Customer, CustomerType

EMAIL_ERROR = _('Укажите корректный адрес электронной почты')
PHONE_ERROR = _('Укажите корректный номер телефона')


def normalize_email(value: str) -> str:
    return value.strip().lower()


def normalize_phone(value: str) -> str:
    digits = re.sub(r'\D', '', value or '')
    if not digits:
        return ''
    if digits.startswith('8') and len(digits) == 11:
        digits = '7' + digits[1:]
    if len(digits) < 10:
        raise serializers.ValidationError(PHONE_ERROR)
    return f'+{digits}'


class TagsField(serializers.ListField[str]):
    child = serializers.CharField(max_length=50)

    def to_internal_value(self, data: Any):
        values = super().to_internal_value(data)
        return [value.strip() for value in values if value.strip()]


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = (
            'id',
            'name',
            'legal_name',
            'inn',
            'kpp',
            'ogrn',
            'email',
            'phone',
            'website',
            'notes',
            'is_active',
        )
        read_only_fields = ('id', 'is_active')


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = (
            'id',
            'title',
            'address_type',
            'postal_code',
            'country',
            'region',
            'city',
            'street',
            'building',
            'apartment',
            'comment',
            'is_primary',
            'is_active',
        )
        read_only_fields = ('id', 'is_active')


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = (
            'id',
            'name',
            'position',
            'email',
            'phone',
            'notes',
            'is_primary',
            'is_active',
        )
        read_only_fields = ('id', 'is_active')


class CustomerSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    tags = TagsField(required=False)
    customer_type = serializers.ChoiceField(choices=CustomerType.choices)
    company = serializers.PrimaryKeyRelatedField(
        queryset=Company.objects.all(), allow_null=True, required=False
    )
    owner = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Customer
        fields = (
            'id',
            'first_name',
            'last_name',
            'middle_name',
            'full_name',
            'email',
            'phone',
            'tags',
            'gdpr_consent',
            'marketing_consent',
            'customer_type',
            'company',
            'owner',
            'notes',
            'is_active',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'full_name', 'is_active', 'created_at', 'updated_at')

    def validate_email(self, value: str) -> str:
        if not value:
            raise serializers.ValidationError(EMAIL_ERROR)
        normalized = normalize_email(value)
        if not normalized:
            raise serializers.ValidationError(EMAIL_ERROR)
        queryset = Customer.objects.filter(email__iexact=normalized)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(_('Клиент с таким e-mail уже существует'))
        return normalized

    def validate_phone(self, value: str) -> str:
        normalized = normalize_phone(value)
        queryset = Customer.objects.filter(phone=normalized)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(_('Клиент с таким телефоном уже существует'))
        return normalized

    def validate_company(self, value: Company | None) -> Company | None:
        if isinstance(value, dict):
            return value
        if value and not value.is_active:
            raise serializers.ValidationError(_('Нельзя привязать архивную компанию'))
        return value

    def create(self, validated_data):
        try:
            return Customer.objects.create(**validated_data)
        except IntegrityError as exc:  # pragma: no cover - defensive
            raise serializers.ValidationError({'detail': _('Не удалось создать клиента')}) from exc

    def update(self, instance: Customer, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class CustomerDetailSerializer(CustomerSerializer):
    addresses = AddressSerializer(many=True, required=False)
    contacts = ContactSerializer(many=True, required=False)
    company = CompanySerializer(allow_null=True, required=False)

    class Meta(CustomerSerializer.Meta):
        fields = CustomerSerializer.Meta.fields + ('addresses', 'contacts')

    def _resolve_company(
        self, company_data: dict[str, Any] | None, owner
    ) -> Company | None:
        if company_data is None:
            return None
        company_id = company_data.get('id') if isinstance(company_data, dict) else None
        if company_id:
            try:
                return Company.objects.get(pk=company_id)
            except Company.DoesNotExist as exc:  # pragma: no cover - validation guard
                raise serializers.ValidationError(_('Компания не найдена')) from exc

        payload = {key: value for key, value in company_data.items() if key in CompanySerializer.Meta.fields}
        payload.pop('id', None)
        payload.pop('is_active', None)
        company = Company(**payload)
        if owner and company.owner_id is None:
            company.owner = owner
        company.full_clean()
        company.save()
        return company

    def _sync_addresses(self, customer: Customer, addresses_data: list[dict[str, Any]]):
        existing = {address.id: address for address in customer.addresses.all()}
        touched: set[int] = set()
        for payload in addresses_data:
            address_id = payload.get('id')
            if address_id and address_id in existing:
                address = existing[address_id]
                for attr, value in payload.items():
                    if attr in AddressSerializer.Meta.fields and attr not in {'id', 'is_active'}:
                        setattr(address, attr, value)
                if 'is_active' in payload:
                    address.is_active = payload['is_active']
                address.full_clean()
                address.save()
                touched.add(address.id)
            else:
                new_payload = {key: value for key, value in payload.items() if key in AddressSerializer.Meta.fields}
                new_payload.pop('id', None)
                new_payload.pop('is_active', None)
                Address.objects.create(customer=customer, **new_payload)

        to_archive = [addr for addr_id, addr in existing.items() if addr_id not in touched]
        for address in to_archive:
            if address.is_active:
                address.is_active = False
                address.save(update_fields=['is_active'])

    def _sync_contacts(self, customer: Customer, contacts_data: list[dict[str, Any]]):
        existing = {contact.id: contact for contact in customer.contacts.all()}
        touched: set[int] = set()
        for payload in contacts_data:
            contact_id = payload.get('id')
            if contact_id and contact_id in existing:
                contact = existing[contact_id]
                for attr, value in payload.items():
                    if attr in ContactSerializer.Meta.fields and attr not in {'id', 'is_active'}:
                        setattr(contact, attr, value)
                if 'is_active' in payload:
                    contact.is_active = payload['is_active']
                contact.full_clean()
                contact.save()
                touched.add(contact.id)
            else:
                new_payload = {key: value for key, value in payload.items() if key in ContactSerializer.Meta.fields}
                new_payload.pop('id', None)
                new_payload.pop('is_active', None)
                Contact.objects.create(customer=customer, **new_payload)

        to_archive = [contact for contact_id, contact in existing.items() if contact_id not in touched]
        for contact in to_archive:
            if contact.is_active:
                contact.is_active = False
                contact.save(update_fields=['is_active'])

    def create(self, validated_data):
        addresses_data = validated_data.pop('addresses', [])
        contacts_data = validated_data.pop('contacts', [])
        company_payload = validated_data.pop('company', None)

        request = self.context.get('request')
        owner = validated_data.get('owner') or getattr(request, 'user', None)
        if owner and owner.is_authenticated:
            validated_data['owner'] = owner

        with transaction.atomic():
            company = self._resolve_company(company_payload, owner)
            if company:
                validated_data['company'] = company
            customer = super().create(validated_data)
            self._sync_addresses(customer, addresses_data)
            self._sync_contacts(customer, contacts_data)
        return customer

    def update(self, instance: Customer, validated_data):
        addresses_data = validated_data.pop('addresses', None)
        contacts_data = validated_data.pop('contacts', None)
        company_payload = validated_data.pop('company', serializers.empty)

        with transaction.atomic():
            if company_payload is not serializers.empty:
                if company_payload is None:
                    instance.company = None
                else:
                    owner = instance.owner or getattr(self.context.get('request'), 'user', None)
                    instance.company = self._resolve_company(company_payload, owner)
            instance = super().update(instance, validated_data)

            if addresses_data is not None:
                self._sync_addresses(instance, addresses_data)
            if contacts_data is not None:
                self._sync_contacts(instance, contacts_data)

        return instance


class CustomerListSerializer(CustomerSerializer):
    company = CompanySerializer(read_only=True)

    class Meta(CustomerSerializer.Meta):
        fields = CustomerSerializer.Meta.fields

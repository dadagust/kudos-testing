"""Serializers for the customer API."""

from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from applications.users.models import RoleChoices

from .models import Company, Contact, Customer, CustomerType, PhoneNormalizer

User = get_user_model()


class CompanySerializer(serializers.ModelSerializer):
    created_at = serializers.DateTimeField(source='created', read_only=True)
    updated_at = serializers.DateTimeField(source='modified', read_only=True)

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
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')


class CompanyInputSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(required=False)

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
        )

    def validate_email(self, value: str) -> str:
        return value.lower() if value else value

    def validate_phone(self, value: str) -> str:
        return PhoneNormalizer.normalize(value) if value else value


class ContactSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(required=False, allow_blank=True)
    created_at = serializers.DateTimeField(source='created', read_only=True)
    updated_at = serializers.DateTimeField(source='modified', read_only=True)

    class Meta:
        model = Contact
        fields = (
            'id',
            'first_name',
            'last_name',
            'email',
            'phone',
            'position',
            'notes',
            'is_primary',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_email(self, value: str) -> str:
        return value.lower() if value else value

    def validate_phone(self, value: str) -> str:
        return PhoneNormalizer.normalize(value) if value else value

    def create(self, validated_data: dict[str, Any]) -> Contact:
        customer: Customer = self.context['customer']
        company = customer.company if customer.customer_type == CustomerType.BUSINESS else None
        return Contact.objects.create(customer=customer, company=company, **validated_data)


class CustomerListSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    full_name = serializers.CharField(read_only=True)
    owner_id = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(source='created', read_only=True)
    updated_at = serializers.DateTimeField(source='modified', read_only=True)

    class Meta:
        model = Customer
        fields = (
            'id',
            'customer_type',
            'full_name',
            'display_name',
            'email',
            'phone',
            'gdpr_consent',
            'company',
            'owner_id',
            'is_active',
            'created_at',
            'updated_at',
        )
        read_only_fields = (
            'id',
            'full_name',
            'created_at',
            'updated_at',
        )


class CustomerDetailSerializer(CustomerListSerializer):
    contacts = ContactSerializer(many=True, read_only=True)

    class Meta(CustomerListSerializer.Meta):
        fields = CustomerListSerializer.Meta.fields + (
            'first_name',
            'last_name',
            'middle_name',
            'notes',
            'contacts',
        )


class CustomerWriteSerializer(serializers.ModelSerializer):
    company = CompanyInputSerializer(required=False, allow_null=True)
    owner_id = serializers.PrimaryKeyRelatedField(
        source='owner', queryset=User.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = Customer
        fields = (
            'customer_type',
            'first_name',
            'last_name',
            'middle_name',
            'display_name',
            'email',
            'phone',
            'gdpr_consent',
            'company',
            'notes',
            'owner_id',
        )

    def validate_email(self, value: str) -> str:
        value = value.lower().strip() if value else ''
        if not value:
            return value

        qs = Customer.objects.filter(email__iexact=value)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Клиент с таким email уже существует')
        return value

    def validate_phone(self, value: str) -> str:
        value = value.strip() if value else ''
        if not value:
            return value
        normalized = PhoneNormalizer.normalize(value)
        qs = Customer.objects.filter(phone_normalized=normalized)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Клиент с таким телефоном уже существует')
        return normalized

    def validate_owner(self, owner):  # type: ignore[override]
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        profile = getattr(user, 'profile', None)
        role = getattr(profile, 'role', None)

        if role not in (RoleChoices.ADMIN, RoleChoices.SALES_MANAGER):
            return user
        return owner or user

    def validate_company(self, value: dict[str, Any] | None) -> dict[str, Any] | None:
        if not value:
            return None
        if 'id' in value and len(value) == 1:
            return {'id': value['id']}
        serializer = CompanyInputSerializer(data=value)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data

    @transaction.atomic
    def create(self, validated_data: dict[str, Any]) -> Customer:
        company_data = validated_data.pop('company', None)
        phone = validated_data.pop('phone', '')
        if phone:
            validated_data['phone'] = phone
            validated_data['phone_normalized'] = phone
        customer = Customer.objects.create(**validated_data)
        if company_data:
            company = self._upsert_company(company_data)
            customer.company = company
            customer.save(update_fields=['company', 'modified'])
        return customer

    @transaction.atomic
    def update(self, instance: Customer, validated_data: dict[str, Any]) -> Customer:
        company_data = validated_data.pop('company', None)
        phone = validated_data.pop('phone', None)
        if phone is not None:
            validated_data['phone'] = phone
            validated_data['phone_normalized'] = phone
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if company_data is not None:
            if company_data:
                company = self._upsert_company(company_data)
                if instance.company_id != company.id:
                    instance.company = company
                    instance.save(update_fields=['company', 'modified'])
            else:
                instance.company = None
                instance.save(update_fields=['company', 'modified'])
        return instance

    def _upsert_company(self, data: dict[str, Any]) -> Company:
        company_id = data.pop('id', None)
        if company_id:
            company = Company.objects.filter(pk=company_id).first()
            if not company:
                raise serializers.ValidationError('Компания не найдена')
            for field, value in data.items():
                setattr(company, field, value)
            company.save()
            return company
        return Company.objects.create(**data)


def get_customer_serializer(action: str) -> type[serializers.ModelSerializer]:
    if action == 'list':
        return CustomerListSerializer
    if action in {'retrieve', 'create', 'update', 'partial_update'}:
        return CustomerDetailSerializer
    return CustomerDetailSerializer


__all__ = [
    'CompanySerializer',
    'ContactSerializer',
    'CustomerDetailSerializer',
    'CustomerListSerializer',
    'CustomerWriteSerializer',
    'get_customer_serializer',
]

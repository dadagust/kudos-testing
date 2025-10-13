"""REST API endpoints for customer domain."""

from __future__ import annotations

from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from applications.core.models import RoleChoices

from .models import Contact, Customer, PhoneNormalizer
from .permissions import CustomerAccessPolicy
from .serializers import (
    ContactSerializer,
    CustomerDetailSerializer,
    CustomerWriteSerializer,
    get_customer_serializer,
)
from .utils import QueryParamsHelper


class CustomerViewSet(viewsets.ModelViewSet):
    """Full CRUD endpoint for customers with scoped access."""

    queryset = Customer.objects.all().select_related('company', 'owner').prefetch_related(
        Prefetch('contacts', queryset=Contact.objects.filter(is_active=True)),
    )
    permission_classes = [IsAuthenticated, CustomerAccessPolicy]

    def get_queryset(self):
        queryset = super().get_queryset()
        queryset = queryset.filter(is_active=True)

        user = self.request.user
        profile = getattr(user, 'profile', None)
        role = getattr(profile, 'role', RoleChoices.CUSTOMER)

        if role in (RoleChoices.ADMIN, RoleChoices.SALES_MANAGER):
            return queryset
        if role in (RoleChoices.CUSTOMER, RoleChoices.B2B):
            return queryset.filter(owner=user)
        if role in (
            RoleChoices.WAREHOUSE,
            RoleChoices.ACCOUNTANT,
            RoleChoices.DRIVER,
            RoleChoices.LOADER,
        ):
            return queryset
        return queryset.none()

    def get_serializer_class(self):
        if self.action in {'create', 'update', 'partial_update'}:
            return CustomerWriteSerializer
        return get_customer_serializer(self.action)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def filter_queryset(self, queryset):  # type: ignore[override]
        helper = QueryParamsHelper(self.request)
        queryset = queryset

        search = helper.get_search()
        if search:
            queryset = queryset.filter(
                Q(display_name__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
            )

        email = helper.get_filter('email').lower()
        if email:
            queryset = queryset.filter(email__iexact=email)

        phone = helper.get_filter('phone')
        if phone:
            phone_normalized = PhoneNormalizer.normalize(phone)
            queryset = queryset.filter(phone_normalized=phone_normalized)

        company_id = helper.get_filter('company_id')
        if company_id:
            queryset = queryset.filter(company_id=company_id)

        created_from = helper.get_filter_datetime('created_at', 'from')
        if created_from:
            queryset = queryset.filter(created_at__gte=created_from)
        created_to = helper.get_filter_datetime('created_at', 'to')
        if created_to:
            queryset = queryset.filter(created_at__lte=created_to)

        sort_fields = helper.get_sort_fields({'name': 'display_name', 'created_at': 'created_at'})
        if sort_fields:
            queryset = queryset.order_by(*sort_fields)
        else:
            queryset = queryset.order_by('-created_at')

        return queryset

    def create(self, request, *args, **kwargs):
        serializer = CustomerWriteSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        customer = serializer.save()
        read_serializer = CustomerDetailSerializer(customer, context=self.get_serializer_context())
        payload = {'data': read_serializer.data}
        headers = self.get_success_headers(read_serializer.data)
        return Response(payload, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = CustomerWriteSerializer(
            instance, data=request.data, context=self.get_serializer_context(), partial=partial
        )
        serializer.is_valid(raise_exception=True)
        customer = serializer.save()
        read_serializer = CustomerDetailSerializer(customer, context=self.get_serializer_context())
        return Response({'data': read_serializer.data})

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = CustomerDetailSerializer(instance, context=self.get_serializer_context())
        return Response({'data': serializer.data})

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        if isinstance(response.data, list):
            response.data = {'data': response.data}
        return response

    def perform_destroy(self, instance: Customer) -> None:
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])


class CustomerContactViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, CustomerAccessPolicy]
    serializer_class = ContactSerializer

    def get_customer(self) -> Customer:
        if not hasattr(self, '_customer'):
            customer = get_object_or_404(Customer, pk=self.kwargs['customer_id'], is_active=True)
            self.check_object_permissions(self.request, customer)
            self._customer = customer
        return self._customer  # type: ignore[attr-defined]

    def get_queryset(self):  # type: ignore[override]
        customer = self.get_customer()
        return customer.contacts.filter(is_active=True).order_by('-is_primary', '-created_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['customer'] = self.get_customer()
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contact = serializer.save()
        read_serializer = self.get_serializer(contact)
        headers = self.get_success_headers(read_serializer.data)
        return Response({'data': read_serializer.data}, status=status.HTTP_201_CREATED, headers=headers)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        if isinstance(response.data, list):
            response.data = {'data': response.data}
        return response


__all__ = ['CustomerViewSet', 'CustomerContactViewSet']

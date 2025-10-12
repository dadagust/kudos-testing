from __future__ import annotations

from datetime import datetime

from django.db.models import Q
from django.db import NotSupportedError, connection
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from applications.core.models import RoleChoices

from .models import Customer
from .permissions import CustomerAccessPermission
from .serializers import (
    ContactSerializer,
    CustomerDetailSerializer,
    CustomerListSerializer,
)


class CustomerPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.select_related('company', 'owner').prefetch_related(
        'addresses', 'contacts'
    )
    serializer_class = CustomerListSerializer
    permission_classes = [IsAuthenticated, CustomerAccessPermission]
    ordering_fields = ('created_at', 'first_name', 'last_name')
    ordering = '-created_at'
    pagination_class = CustomerPagination

    def get_serializer_class(self):
        if self.action == 'contacts':
            return ContactSerializer
        if self.action in {'retrieve', 'create', 'update', 'partial_update'}:
            return CustomerDetailSerializer
        return CustomerListSerializer

    def get_queryset(self):
        queryset = super().get_queryset().filter(is_active=True)
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()
        if user.is_superuser:
            return queryset

        role = getattr(getattr(user, 'profile', None), 'role', None)
        if role in {RoleChoices.CUSTOMER, RoleChoices.B2B}:
            return queryset.filter(owner=user)
        return queryset

    def filter_queryset(self, queryset):
        params = self.request.query_params

        search_term = params.get('q')
        if search_term:
            queryset = queryset.filter(
                Q(first_name__icontains=search_term)
                | Q(last_name__icontains=search_term)
                | Q(middle_name__icontains=search_term)
                | Q(email__icontains=search_term)
                | Q(phone__icontains=search_term)
            )

        email = params.get('email')
        if email:
            queryset = queryset.filter(email__iexact=email.strip().lower())

        phone = params.get('phone')
        if phone:
            queryset = queryset.filter(phone=phone)

        tag = params.get('tag')
        if tag:
            vendor = connection.vendor
            if vendor == 'sqlite':
                matching_ids = [obj.id for obj in queryset if tag in (obj.tags or [])]
                queryset = queryset.filter(id__in=matching_ids)
            else:
                try:
                    queryset = queryset.filter(tags__contains=[tag])
                except NotSupportedError:
                    matching_ids = [obj.id for obj in queryset if tag in (obj.tags or [])]
                    queryset = queryset.filter(id__in=matching_ids)

        company_id = params.get('company_id')
        if company_id:
            queryset = queryset.filter(company_id=company_id)

        created_from = params.get('created_at__gte')
        if created_from:
            try:
                dt = datetime.fromisoformat(created_from)
                queryset = queryset.filter(created_at__gte=dt)
            except ValueError:
                pass

        created_to = params.get('created_at__lte')
        if created_to:
            try:
                dt = datetime.fromisoformat(created_to)
                queryset = queryset.filter(created_at__lte=dt)
            except ValueError:
                pass

        ordering = params.get('ordering')
        if ordering in {'name', '-name'}:
            direction = '-' if ordering.startswith('-') else ''
            queryset = queryset.order_by(f"{direction}last_name", f"{direction}first_name")
        elif ordering in {'created_at', '-created_at'}:
            queryset = queryset.order_by(ordering)

        return queryset

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.deactivate()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get', 'post'], url_path='contacts')
    def contacts(self, request, *args, **kwargs):
        customer = self.get_object()

        if request.method == 'GET':
            serializer = self.get_serializer(customer.contacts.all(), many=True)
            return Response(serializer.data)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contact = serializer.save(customer=customer)
        output_serializer = self.get_serializer(contact)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

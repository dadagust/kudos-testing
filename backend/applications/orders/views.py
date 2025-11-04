"""REST API endpoints for order management."""

from __future__ import annotations

from django.db import transaction
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Order, OrderStatus
from .permissions import OrderAccessPolicy
from .serializers import (
    OrderCalculationSerializer,
    OrderDetailSerializer,
    OrderSummarySerializer,
    OrderWriteSerializer,
)
from .services import adjust_available_stock, collect_order_item_totals


class OrderViewSet(viewsets.ModelViewSet):
    """CRUD endpoint for managing orders."""

    queryset = Order.objects.all().select_related('customer').prefetch_related('items')
    permission_classes = (
        IsAuthenticated,
        OrderAccessPolicy,
    )

    def get_serializer_class(self):
        if self.action in {'create', 'update', 'partial_update'}:
            return OrderWriteSerializer
        if self.action == 'retrieve':
            return OrderDetailSerializer
        return OrderSummarySerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def filter_queryset(self, queryset):  # type: ignore[override]
        queryset = super().filter_queryset(queryset)
        params = self.request.query_params

        status_group = params.get('status_group')
        if status_group:
            queryset = queryset.for_status_group(status_group)

        status_value = params.get('status')
        if status_value:
            queryset = queryset.filter(status=status_value)

        search = params.get('search')
        if search:
            queryset = queryset.filter(
                Q(comment__icontains=search)
                | Q(delivery_address__icontains=search)
                | Q(customer__display_name__icontains=search)
                | Q(customer__first_name__icontains=search)
                | Q(customer__last_name__icontains=search)
            )

        return queryset.order_by('-created')

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        if isinstance(response.data, list):
            response.data = {'data': response.data}
        return response

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = OrderDetailSerializer(instance, context=self.get_serializer_context())
        return Response({'data': serializer.data})

    def create(self, request, *args, **kwargs):
        serializer = OrderWriteSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        read_serializer = OrderDetailSerializer(order, context=self.get_serializer_context())
        headers = self.get_success_headers(read_serializer.data)
        return Response(
            {'data': read_serializer.data}, status=status.HTTP_201_CREATED, headers=headers
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = OrderWriteSerializer(
            instance,
            data=request.data,
            context=self.get_serializer_context(),
            partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        read_serializer = OrderDetailSerializer(order, context=self.get_serializer_context())
        return Response({'data': read_serializer.data})

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    @transaction.atomic
    def perform_destroy(self, instance):  # type: ignore[override]
        if instance.status != OrderStatus.DECLINED:
            product_totals = collect_order_item_totals(instance)
            if product_totals:
                adjust_available_stock(product_totals, increment=True)
        super().perform_destroy(instance)


class OrderCalculationView(APIView):
    permission_classes = (
        IsAuthenticated,
        OrderAccessPolicy,
    )

    def post(self, request, *args, **kwargs):
        serializer = OrderCalculationSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.calculate()
        return Response({'data': result}, status=status.HTTP_200_OK)

"""REST API endpoints for order management."""

from __future__ import annotations

from django.db import models, transaction
from django.db.models import Q
from django.db.models.functions import Cast
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Order, OrderStatus
from .permissions import OrderAccessPolicy
from .serializers import (
    OrderLogisticsStateUpdateSerializer,
    OrderCalculationSerializer,
    OrderDetailSerializer,
    OrderPaymentStatusUpdateSerializer,
    OrderReceiveSerializer,
    OrderSummarySerializer,
    OrderWriteSerializer,
)
from .services import reset_order_transactions


class OrderViewSet(viewsets.ModelViewSet):
    """CRUD endpoint for managing orders."""

    queryset = (
        Order.objects.all()
        .select_related('customer', 'warehouse_received_by')
        .prefetch_related('items__product')
    )
    permission_classes = (
        IsAuthenticated,
        OrderAccessPolicy,
    )

    def get_serializer_class(self):
        if self.action in {'create', 'update', 'partial_update'}:
            return OrderWriteSerializer
        if self.action == 'retrieve':
            return OrderDetailSerializer
        if self.action == 'update_payment_status':
            return OrderPaymentStatusUpdateSerializer
        if self.action == 'update_logistics_state':
            return OrderLogisticsStateUpdateSerializer
        if self.action == 'receive':
            return OrderReceiveSerializer
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

        payment_status_values = params.getlist('payment_status')
        if payment_status_values:
            queryset = queryset.filter(payment_status__in=payment_status_values)

        logistics_states = params.getlist('logistics_state')
        if logistics_states:
            normalized_states = [value for value in logistics_states if value and value != 'null']
            include_null = any(value == 'null' for value in logistics_states)
            state_filter = Q()
            if normalized_states:
                state_filter |= Q(logistics_state__in=normalized_states)
            if include_null:
                state_filter |= Q(logistics_state__isnull=True)
            if state_filter:
                queryset = queryset.filter(state_filter)

        shipment_from = parse_date(params.get('shipment_date_from') or '')
        if shipment_from:
            queryset = queryset.filter(shipment_date__gte=shipment_from)

        shipment_to = parse_date(params.get('shipment_date_to') or '')
        if shipment_to:
            queryset = queryset.filter(shipment_date__lte=shipment_to)

        order_query = params.get('q')
        if order_query:
            normalized_order_query = order_query.strip()
            if normalized_order_query:
                queryset = queryset.annotate(number_str=Cast('pk', output_field=models.CharField()))
                queryset = queryset.filter(
                    Q(number_str__icontains=normalized_order_query)
                    | Q(delivery_address__icontains=normalized_order_query)
                    | Q(comment__icontains=normalized_order_query)
                )

        search = params.get('search')
        if search:
            queryset = queryset.filter(
                Q(comment__icontains=search)
                | Q(delivery_address__icontains=search)
                | Q(customer__display_name__icontains=search)
                | Q(customer__first_name__icontains=search)
                | Q(customer__last_name__icontains=search)
            )

        return queryset.order_by('-shipment_date', '-created')

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
            reset_order_transactions(instance)
        super().perform_destroy(instance)

    @action(detail=True, methods=['patch'], url_path='payment-status')
    def update_payment_status(self, request, *args, **kwargs):
        order = self.get_object()
        serializer = OrderPaymentStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment_status = serializer.validated_data['payment_status']
        if order.payment_status != payment_status:
            order.payment_status = payment_status
            order.save(update_fields=['payment_status'])
        read_serializer = OrderSummarySerializer(order, context=self.get_serializer_context())
        return Response({'data': read_serializer.data})

    @action(detail=True, methods=['patch'], url_path='logistics-state')
    def update_logistics_state(self, request, *args, **kwargs):
        order = self.get_object()
        serializer = OrderLogisticsStateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        logistics_state = serializer.validated_data.get('logistics_state')
        if logistics_state == '' or logistics_state is None:
            logistics_state = None
        if order.logistics_state != logistics_state:
            order.logistics_state = logistics_state
            order.save(update_fields=['logistics_state'])
        read_serializer = OrderSummarySerializer(order, context=self.get_serializer_context())
        return Response({'data': read_serializer.data})

    @action(detail=True, methods=['post'], url_path='receive')
    def receive(self, request, *args, **kwargs):
        order = self.get_object()
        serializer = OrderReceiveSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        if not order.warehouse_received_at:
            order.warehouse_received_at = timezone.now()
            if not order.warehouse_received_by_id:
                order.warehouse_received_by = request.user
            order.save(update_fields=['warehouse_received_at', 'warehouse_received_by'])
        read_serializer = OrderSummarySerializer(order, context=self.get_serializer_context())
        return Response({'data': read_serializer.data})


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

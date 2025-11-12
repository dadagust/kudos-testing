"""REST API endpoints for order management."""

from __future__ import annotations

import os
from decimal import Decimal

import requests
from django.conf import settings
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

from .models import Order, OrderDriver, OrderStatus
from .permissions import OrderAccessPolicy
from .serializers import (
    OrderAddressValidationSerializer,
    OrderCalculationSerializer,
    OrderDetailSerializer,
    OrderDriverAssignSerializer,
    OrderDriverSerializer,
    OrderLogisticsStateUpdateSerializer,
    OrderPaymentStatusUpdateSerializer,
    OrderReceiveSerializer,
    OrderSummarySerializer,
    OrderWriteSerializer,
)
from .services import reset_order_transactions
from .services.yandex_maps import YandexMapsError, geocode_address


class OrderViewSet(viewsets.ModelViewSet):
    """CRUD endpoint for managing orders."""

    queryset = (
        Order.objects.all()
        .select_related('customer', 'warehouse_received_by')
        .prefetch_related('items__product')
    )
    permission_classes = (IsAuthenticated,)

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

        normalized_search = (params.get('search') or '').strip()
        normalized_order_query = (params.get('q') or '').strip()

        if normalized_search or normalized_order_query:
            queryset = queryset.annotate(number_str=Cast('pk', output_field=models.CharField()))

        if normalized_order_query:
            queryset = queryset.filter(
                Q(number_str__icontains=normalized_order_query)
                | Q(delivery_address_input__icontains=normalized_order_query)
                | Q(delivery_address_full__icontains=normalized_order_query)
                | Q(comment__icontains=normalized_order_query)
                | Q(comment_for_waybill__icontains=normalized_order_query)
            )

        if normalized_search:
            queryset = queryset.filter(
                Q(number_str__icontains=normalized_search)
                | Q(comment__icontains=normalized_search)
                | Q(comment_for_waybill__icontains=normalized_search)
                | Q(delivery_address_input__icontains=normalized_search)
                | Q(delivery_address_full__icontains=normalized_search)
                | Q(customer__display_name__icontains=normalized_search)
                | Q(customer__first_name__icontains=normalized_search)
                | Q(customer__last_name__icontains=normalized_search)
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

    @action(detail=True, methods=['post'], url_path='driver')
    def assign_driver(self, request, *args, **kwargs):
        order = self.get_object()
        serializer = OrderDriverAssignSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        created = False
        try:
            driver = order.driver
        except OrderDriver.DoesNotExist:
            driver = OrderDriver(order=order)
            created = True

        driver.full_name = payload['full_name']
        driver.phone = payload['phone']
        driver.save()

        read_serializer = OrderDriverSerializer(driver)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response({'data': read_serializer.data}, status=status_code)

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

    @action(detail=True, methods=['post'], url_path='validate-address')
    def validate_address(self, request, *args, **kwargs):
        order = self.get_object()
        serializer = OrderAddressValidationSerializer(data=request.data)
        if not serializer.is_valid():
            error_message = serializer.errors.get('input')
            if isinstance(error_message, list) and error_message:
                message = str(error_message[0])
            else:
                message = 'Укажите адрес для валидации.'
            return Response(
                {'ok': False, 'reason': 'empty', 'message': message},
                status=status.HTTP_400_BAD_REQUEST,
            )
        query = serializer.validated_data['input']

        try:
            geocoded = geocode_address(query)
        except YandexMapsError as exc:
            return Response(
                {'ok': False, 'reason': 'configuration', 'message': str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except requests.RequestException as exc:
            return Response(
                {'ok': False, 'reason': 'network', 'message': str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if not geocoded:
            return Response(
                {'ok': False, 'reason': 'not_found', 'message': 'Адрес не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        order.delivery_address_input = query
        order.delivery_address_full = geocoded.get('normalized', '') or ''
        lat = geocoded.get('lat')
        lon = geocoded.get('lon')
        order.delivery_lat = Decimal(str(lat)) if lat is not None else None
        order.delivery_lon = Decimal(str(lon)) if lon is not None else None
        order.delivery_address_kind = geocoded.get('kind', '') or ''
        order.delivery_address_precision = geocoded.get('precision', '') or ''
        order.yandex_uri = geocoded.get('uri', '') or ''
        order.save(
            update_fields=[
                'delivery_address_input',
                'delivery_address_full',
                'delivery_lat',
                'delivery_lon',
                'delivery_address_kind',
                'delivery_address_precision',
                'yandex_uri',
            ]
        )

        read_serializer = OrderSummarySerializer(order, context=self.get_serializer_context())
        response_payload = {
            'ok': True,
            'exists': order.has_exact_address(),
            'normalized': order.delivery_address_full,
            'lat': lat,
            'lon': lon,
            'kind': order.delivery_address_kind,
            'precision': order.delivery_address_precision,
            'uri': order.yandex_uri,
            'order': read_serializer.data,
        }
        return Response(response_payload, status=status.HTTP_200_OK)


class YandexSuggestView(APIView):
    """Proxy Yandex Geosuggest requests through the backend."""

    permission_classes = (IsAuthenticated,)
    request_timeout = 7
    suggest_url = 'https://suggest-maps.yandex.ru/v1/suggest'

    @staticmethod
    def _resolve_api_key() -> str:
        key = settings.GEOSUGGEST_KEY
        if isinstance(key, (list, tuple)):
            key = next((value for value in key if value), '')
        if not key:
            key = getattr(settings, 'YANDEX_SUGGEST_KEY', '') or os.environ.get(
                'YANDEX_SUGGEST_KEY', ''
            )
        return str(key or '')

    def get(self, request):
        query = (request.query_params.get('q') or '').strip()
        if not query:
            return Response({'results': []})

        api_key = self._resolve_api_key()
        if not api_key:
            return Response(
                {'detail': 'Geosuggest API key is not configured.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        params = {
            'apikey': api_key,
            'text': query,
            'lang': 'ru_RU',
            'types': 'geo',
            'print_address': '1',
            'results': '5',
        }

        headers = {'Referer': os.environ.get('YandexReferer', '')}  # апи яндекс карт - величие

        try:
            upstream = requests.get(
                self.suggest_url, params=params, headers=headers, timeout=self.request_timeout
            )
        except requests.RequestException as exc:
            return Response(
                {'detail': f'Upstream error: {exc}'}, status=status.HTTP_502_BAD_GATEWAY
            )

        try:
            payload = upstream.json()
        except ValueError:
            payload = {'detail': upstream.text[:500]}

        return Response(payload, status=upstream.status_code)


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


class OrdersWithCoordsView(APIView):
    permission_classes = (
        IsAuthenticated,
        OrderAccessPolicy,
    )

    def get(self, request, *args, **kwargs):
        queryset = (
            Order.objects.exclude(delivery_lat__isnull=True)
            .exclude(delivery_lon__isnull=True)
            .select_related('driver')
        )
        items = []
        for order in queryset:
            driver = getattr(order, 'driver', None)
            items.append(
                {
                    'id': order.pk,
                    'address': order.delivery_address_full or order.delivery_address_input,
                    'lat': float(order.delivery_lat),
                    'lon': float(order.delivery_lon),
                    'exact': order.has_exact_address(),
                    'driver': (
                        {
                            'id': driver.pk,
                            'full_name': driver.full_name,
                            'phone': driver.phone,
                        }
                        if driver
                        else None
                    ),
                }
            )
        return Response({'items': items}, status=status.HTTP_200_OK)

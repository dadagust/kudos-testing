"""REST API endpoints for order management."""

from __future__ import annotations

from django.db.models import Prefetch, Q
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Order, OrderItem, OrderStatus
from .permissions import OrderAccessPolicy
from .serializers import OrderDetailSerializer, OrderListSerializer, OrderWriteSerializer
from .utils import OrderQueryParamsHelper


class OrderViewSet(viewsets.ModelViewSet):
    """Full CRUD endpoint for orders."""

    queryset = Order.objects.all().select_related('customer').prefetch_related(
        Prefetch('items', queryset=OrderItem.objects.filter(is_active=True))
    )
    permission_classes = [IsAuthenticated, OrderAccessPolicy]

    def get_queryset(self):
        queryset = super().get_queryset()
        queryset = queryset.filter(is_active=True)
        helper = OrderQueryParamsHelper(self.request)

        scope = helper.get_scope()
        if scope in {'archived', 'archive'}:
            queryset = queryset.filter(status=OrderStatus.ARCHIVED)
        elif scope in {'cancelled', 'canceled', 'cancel'}:
            queryset = queryset.filter(status=OrderStatus.CANCELLED)
        else:
            queryset = queryset.exclude(status__in=[OrderStatus.ARCHIVED, OrderStatus.CANCELLED])

        status_filter = helper.get_status()
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        customer_id = helper.get_customer_id()
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        search = helper.get_search()
        if search:
            search_q = Q(comment__icontains=search) | Q(delivery_address__icontains=search) | Q(
                customer__display_name__icontains=search
            ) | Q(customer__first_name__icontains=search) | Q(customer__last_name__icontains=search)
            if search.isdigit():
                try:
                    search_q |= Q(pk=int(search))
                except ValueError:
                    pass
            queryset = queryset.filter(search_q)

        installation_from = helper.get_date('installation_date_from')
        if installation_from:
            queryset = queryset.filter(installation_date__gte=installation_from)
        installation_to = helper.get_date('installation_date_to')
        if installation_to:
            queryset = queryset.filter(installation_date__lte=installation_to)

        return queryset.order_by('-installation_date', '-id')

    def get_serializer_class(self):  # type: ignore[override]
        if self.action in {'create', 'update', 'partial_update'}:
            return OrderWriteSerializer
        if self.action == 'retrieve':
            return OrderDetailSerializer
        return OrderListSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

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
        serializer = OrderWriteSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        read_serializer = OrderDetailSerializer(order, context=self.get_serializer_context())
        headers = self.get_success_headers(read_serializer.data)
        return Response({'data': read_serializer.data}, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = OrderWriteSerializer(
            instance, data=request.data, context=self.get_serializer_context(), partial=partial
        )
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        read_serializer = OrderDetailSerializer(order, context=self.get_serializer_context())
        return Response({'data': read_serializer.data})

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    def perform_destroy(self, instance: Order) -> None:
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])


__all__ = ['OrderViewSet']

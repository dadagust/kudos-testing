"""REST API endpoints for order management."""

from __future__ import annotations

from django.db.models import Prefetch
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


from .models import Order, OrderItem
from .permissions import OrderAccessPolicy
from .serializers import OrderDetailSerializer, OrderSummarySerializer, OrderWriteSerializer


class OrderViewSet(viewsets.ModelViewSet):
    queryset = (
        Order.objects.all()
        .select_related('customer', 'created_by')
        .prefetch_related(Prefetch('items', queryset=OrderItem.objects.all()))
    )
    permission_classes = [IsAuthenticated, OrderAccessPolicy]

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset

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
        request = self.request
        params = request.query_params

        status_values = params.getlist('filter[status]') or params.getlist('status')
        if status_values:
            queryset = queryset.filter(status__in=status_values)

        search = params.get('search', '').strip()
        if search:
            if search.isdigit():
                queryset = queryset.filter(pk=int(search))
            else:
                queryset = queryset.filter(comment__icontains=search)

        customer_id = params.get('customer') or params.get('filter[customer]')
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        return queryset.order_by('-created')

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        if isinstance(response.data, list):
            response.data = {'data': response.data}
        return response

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

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = OrderDetailSerializer(instance, context=self.get_serializer_context())
        return Response({'data': serializer.data})

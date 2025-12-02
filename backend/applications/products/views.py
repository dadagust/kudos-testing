"""View layer for the products API."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, models
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.fields import DateTimeField
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .choices import DimensionShape, RentalMode, ReservationMode
from .helpers import _has_error_code, build_category_tree, parse_include_param
from .models import (
    Category,
    Color,
    InstallerQualification,
    Product,
    ProductGroup,
    ProductImage,
    StockTransaction,
    TransportRestriction,
)
from .pagination import ProductCursorPagination
from .serializers import (
    EnumChoiceSerializer,
    ProductBaseSerializer,
    ProductDetailSerializer,
    ProductGroupSerializer,
    ProductImageSerializer,
    ProductListItemSerializer,
    StockTransactionSerializer,
    prefetch_for_include,
)

DATETIME_FIELD = DateTimeField()


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related(
        'category',
        'color',
        'delivery_transport_restriction',
        'setup_installer_qualification',
    )
    serializer_class = ProductBaseSerializer
    pagination_class = ProductCursorPagination
    lookup_field = 'id'

    def handle_exception(self, exc):  # type: ignore[override]
        if isinstance(exc, serializers.ValidationError):
            status_code = status.HTTP_400_BAD_REQUEST
            codes = exc.get_codes()
            if _has_error_code(codes, 'unprocessable_entity'):
                status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
            return Response(
                {'detail': 'Validation error', 'errors': exc.detail}, status=status_code
            )
        return super().handle_exception(exc)

    def create(self, request: Request, *args, **kwargs):  # type: ignore[override]
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            self.perform_create(serializer)
        except IntegrityError as exc:  # pragma: no cover - defensive
            if self._is_slug_conflict(exc):
                return self._slug_conflict_response()
            raise
        product: Product = serializer.instance  # type: ignore[assignment]
        body = {
            'id': str(product.id),
            'created_at': DATETIME_FIELD.to_representation(product.created),
            'updated_at': DATETIME_FIELD.to_representation(product.modified),
        }
        headers = self.get_success_headers({'id': body['id']})
        return Response(body, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request: Request, *args, **kwargs):  # type: ignore[override]
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        try:
            self.perform_update(serializer)
        except IntegrityError as exc:  # pragma: no cover - defensive
            if self._is_slug_conflict(exc):
                return self._slug_conflict_response()
            raise
        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}
        return Response(serializer.data)

    def _slug_conflict_response(self) -> Response:
        return Response(
            {
                'detail': 'URL name already exists',
                'errors': {'seo': {'url_name': ['URL name already exists']}},
            },
            status=status.HTTP_409_CONFLICT,
        )

    @staticmethod
    def _is_slug_conflict(exc: IntegrityError) -> bool:
        message = str(exc).lower()
        return 'seo_url_name' in message or 'slug' in message

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return ProductListItemSerializer
        if self.action == 'retrieve':
            return ProductDetailSerializer
        return ProductBaseSerializer

    def get_queryset(self):  # type: ignore[override]
        queryset = super().get_queryset()
        request = self.request
        assert request is not None
        include = parse_include_param(request)
        if include and getattr(self, 'action', None) != 'list':
            queryset = queryset.prefetch_related(*prefetch_for_include(include))

        q = request.query_params.get('q')
        if q:
            queryset = queryset.filter(Q(name__icontains=q) | Q(features__icontains=q))

        category_id = request.query_params.get('category_id')
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        color = request.query_params.get('color')
        if color:
            queryset = queryset.filter(color_id=color)

        transport = request.query_params.get('transport_restriction')
        if transport:
            queryset = queryset.filter(delivery_transport_restriction_id=transport)

        self_pickup = request.query_params.get('self_pickup')
        if self_pickup in {'true', 'false'}:
            queryset = queryset.filter(delivery_self_pickup_allowed=self_pickup == 'true')

        price_min = request.query_params.get('price_min')
        if price_min:
            try:
                queryset = queryset.filter(price_rub__gte=Decimal(price_min))
            except InvalidOperation:
                pass
        price_max = request.query_params.get('price_max')
        if price_max:
            try:
                queryset = queryset.filter(price_rub__lte=Decimal(price_max))
            except InvalidOperation:
                pass

        ordering = self._resolve_ordering(request.query_params.get('ordering'))
        if ordering:
            queryset = queryset.order_by(ordering)

        return queryset

    def _resolve_ordering(self, ordering: str | None) -> str | None:
        if not ordering:
            return None
        mapping = {
            'created_at': 'created',
            '-created_at': '-created',
            'price_rub': 'price_rub',
            '-price_rub': '-price_rub',
            'updated_at': 'modified',
            '-updated_at': '-modified',
            'name': 'name',
            '-name': '-name',
        }
        return mapping.get(ordering)

    def get_serializer_context(self):  # type: ignore[override]
        context = super().get_serializer_context()
        include = parse_include_param(self.request)
        if include:
            context['include'] = include
        if self.action == 'retrieve':
            context['detail'] = True
        return context

    def paginate_queryset(self, queryset):  # type: ignore[override]
        ordering = self._resolve_ordering(self.request.query_params.get('ordering')) or '-created'
        if self.paginator is not None:
            self.paginator.ordering = ordering
        include = parse_include_param(self.request)
        if include:
            queryset = queryset.prefetch_related(*prefetch_for_include(include))
        return super().paginate_queryset(queryset)

    def perform_create(self, serializer: ProductBaseSerializer):  # type: ignore[override]
        serializer.save()

    def list(self, request: Request, *args, **kwargs):  # type: ignore[override]
        queryset = self.filter_queryset(self.get_queryset())
        totals = self._calculate_totals(queryset)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data['totals'] = totals
            return response
        serializer = self.get_serializer(queryset, many=True)
        return Response({'results': serializer.data, 'next_cursor': None, 'totals': totals})

    @staticmethod
    def _calculate_totals(queryset):
        aggregates = queryset.aggregate(
            positions=models.Count('id', distinct=True),
            total_stock=models.Sum('stock_qty'),
            available_stock=models.Sum('available_stock_qty'),
        )

        total_stock = int(aggregates.get('total_stock') or 0)
        available_stock = int(aggregates.get('available_stock') or 0)
        reserved_stock = max(total_stock - available_stock, 0)

        return {
            'positions': int(aggregates.get('positions') or 0),
            'total_stock_qty': total_stock,
            'available_stock_qty': available_stock,
            'reserved_stock_qty': reserved_stock,
        }

    def perform_update(self, serializer: ProductBaseSerializer):  # type: ignore[override]
        serializer.save()

    @action(detail=True, methods=['post'], url_path='images')
    def upload_images(self, request: Request, id=None):
        product = self.get_object()
        files = request.FILES.getlist('files')
        if not files:
            return Response({'detail': 'No files provided'}, status=status.HTTP_400_BAD_REQUEST)

        max_size = 10 * 1024 * 1024  # 10 MB safety limit
        for file in files:
            content_type = (getattr(file, 'content_type', '') or '').lower()
            if content_type and not content_type.startswith('image/'):
                return Response(
                    {'detail': 'Unsupported media type'},
                    status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                )
            size = getattr(file, 'size', None)
            if size and size > max_size:
                return Response(
                    {'detail': 'Payload too large'},
                    status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                )

        positions = request.data.getlist('positions') if hasattr(request.data, 'getlist') else []
        created_images: list[ProductImage] = []
        next_position = product.images.aggregate(max_pos=models.Max('position')).get('max_pos') or 0

        for index, file in enumerate(files):
            position = positions[index] if index < len(positions) else None
            try:
                position_int = int(position) if position is not None else next_position + 1
            except (TypeError, ValueError):
                position_int = next_position + 1
            next_position = max(next_position, position_int)
            created_images.append(
                ProductImage.objects.create(product=product, file=file, position=position_int)
            )

        serializer = ProductImageSerializer(
            created_images,
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='images/reorder')
    def reorder_images(self, request: Request, id=None):
        product = self.get_object()
        order = request.data.get('order')
        if not isinstance(order, list):
            return Response({'detail': 'order must be a list'}, status=status.HTTP_400_BAD_REQUEST)
        existing_ids = {str(image.id) for image in product.images.all()}
        for item in order:
            if not isinstance(item, dict) or 'id' not in item or 'position' not in item:
                return Response(
                    {'detail': 'Each entry must have id and position'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if str(item['id']) not in existing_ids:
                return Response(
                    {'detail': f'Image {item["id"]} not found'}, status=status.HTTP_404_NOT_FOUND
                )
            try:
                position = int(item['position'])
            except (TypeError, ValueError):
                return Response(
                    {'detail': 'Position must be integer'}, status=status.HTTP_400_BAD_REQUEST
                )
            ProductImage.objects.filter(id=item['id'], product=product).update(position=position)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=True,
        methods=['delete'],
        url_path=r'images/(?P<image_id>[0-9a-fA-F-]{32,36})',
    )
    def delete_image(self, request: Request, image_id: str, id=None):
        product = self.get_object()
        image = get_object_or_404(product.images, id=image_id)
        image.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductTransactionViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    """API endpoints for managing product stock transactions."""

    serializer_class = StockTransactionSerializer

    def get_product(self) -> Product:
        if not hasattr(self, '_product_cache'):
            self._product_cache = get_object_or_404(Product, pk=self.kwargs['id'])
        return self._product_cache  # type: ignore[attr-defined]

    def get_queryset(self):  # type: ignore[override]
        product = self.get_product()
        return StockTransaction.objects.filter(product=product).order_by('-created')

    def get_serializer_context(self):  # type: ignore[override]
        context = super().get_serializer_context()
        context['product'] = self.get_product()
        return context

    def perform_create(self, serializer):  # type: ignore[override]
        serializer.save()


class ProductGroupViewSet(viewsets.ModelViewSet):
    queryset = ProductGroup.objects.all()
    serializer_class = ProductGroupSerializer
    lookup_field = 'id'

    def get_queryset(self):  # type: ignore[override]
        product_queryset = Product.objects.select_related(
            'category', 'color', 'delivery_transport_restriction'
        ).prefetch_related(
            Prefetch('images', queryset=ProductImage.objects.order_by('position')),
        )
        return (
            super()
            .get_queryset()
            .select_related('category')
            .prefetch_related(Prefetch('products', queryset=product_queryset))
        )


class CategoryProductsView(APIView):
    def get(self, request: Request):
        category_id = request.query_params.get('category_id')
        if not category_id:
            return Response(
                {'detail': 'category_id query parameter is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        category = get_object_or_404(Category, pk=category_id)

        product_queryset = Product.objects.filter(category=category).select_related(
            'category', 'color', 'delivery_transport_restriction'
        )
        product_queryset = product_queryset.prefetch_related(
            Prefetch('images', queryset=ProductImage.objects.order_by('position'))
        )

        groups = (
            ProductGroup.objects.filter(category=category)
            .select_related('category')
            .prefetch_related(Prefetch('products', queryset=product_queryset))
        )

        grouped_product_ids = (
            Product.objects.filter(groups__category=category)
            .values_list('id', flat=True)
            .distinct()
        )
        standalone_products = product_queryset.exclude(id__in=grouped_product_ids)

        groups_data = ProductGroupSerializer(
            groups, many=True, context={'request': request}
        ).data
        products_data = ProductListItemSerializer(
            standalone_products, many=True, context={'request': request}
        ).data

        data = [{'item_type': 'group', **group} for group in groups_data]
        data.extend({'item_type': 'product', **product} for product in products_data)

        return Response({'data': data})


class NewProductsView(APIView):
    def get(self, request: Request):
        product_queryset = Product.objects.filter(visibility_show_in_new=True).select_related(
            'category', 'color', 'delivery_transport_restriction'
        )
        product_queryset = product_queryset.prefetch_related(
            Prefetch('images', queryset=ProductImage.objects.order_by('position'))
        )

        groups = (
            ProductGroup.objects.filter(show_in_new=True)
            .select_related('category')
            .prefetch_related(Prefetch('products', queryset=product_queryset))
        )

        grouped_product_ids = (
            Product.objects.filter(groups__show_in_new=True, visibility_show_in_new=True)
            .values_list('id', flat=True)
            .distinct()
        )
        standalone_products = product_queryset.exclude(id__in=grouped_product_ids)

        groups_data = ProductGroupSerializer(
            groups, many=True, context={'request': request}
        ).data
        products_data = ProductListItemSerializer(
            standalone_products, many=True, context={'request': request}
        ).data

        data = [{'item_type': 'group', **group} for group in groups_data]
        data.extend({'item_type': 'product', **product} for product in products_data)

        return Response({'data': data})


class CategoryTreeView(APIView):
    def get(self, request: Request):
        categories = Category.objects.all().order_by('name')
        tree = build_category_tree(list(categories))
        return Response(tree)


class ColorsListView(APIView):
    def get(self, request: Request):
        colors = Color.objects.all().order_by('label')
        data = [{'value': color.value, 'label': color.label} for color in colors]
        serializer = EnumChoiceSerializer(data, many=True)
        return Response(serializer.data)


class EnumsAggregateView(APIView):
    def get(self, request: Request):
        return Response(
            {
                'colors': [
                    {'value': color.value, 'label': color.label}
                    for color in Color.objects.all().order_by('label')
                ],
                'shapes': [
                    {'value': choice.value, 'label': choice.label} for choice in DimensionShape
                ],
                'transport_restrictions': [
                    {'value': restriction.value, 'label': restriction.label}
                    for restriction in TransportRestriction.objects.all().order_by('label')
                ],
                'installer_qualifications': [
                    {'value': str(item.id), 'label': item.name}
                    for item in InstallerQualification.objects.all().order_by('name')
                ],
                'reservation_modes': [
                    {'value': choice.value, 'label': choice.label} for choice in ReservationMode
                ],
                'rental_modes': [
                    {'value': choice.value, 'label': choice.label} for choice in RentalMode
                ],
            }
        )


__all__ = [
    'CategoryTreeView',
    'CategoryProductsView',
    'ColorsListView',
    'EnumsAggregateView',
    'ProductGroupViewSet',
    'ProductTransactionViewSet',
    'ProductViewSet',
]

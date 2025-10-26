"""View layer for the products API."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, models
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.fields import DateTimeField

from .choices import (
    Color,
    DimensionShape,
    InstallerQualification,
    RentalBasePeriod,
    ReservationMode,
    TransportRestriction,
)
from .models import Category, Product, ProductImage
from .pagination import ProductCursorPagination
from .serializers import (
    EnumChoiceSerializer,
    ProductBaseSerializer,
    ProductDetailSerializer,
    ProductImageSerializer,
    ProductListItemSerializer,
    prefetch_for_include,
)


DATETIME_FIELD = DateTimeField()


def parse_include_param(request: Request) -> tuple[str, ...]:
    include = request.query_params.get('include')
    if not include:
        return ()
    return tuple(sorted(filter(None, (item.strip() for item in include.split(',')))))


def _has_error_code(codes, target: str) -> bool:
    if isinstance(codes, str):
        return codes == target
    if isinstance(codes, (list, tuple, set)):
        return any(_has_error_code(item, target) for item in codes)
    if isinstance(codes, dict):
        return any(_has_error_code(value, target) for value in codes.values())
    return False


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related('category')
    serializer_class = ProductBaseSerializer
    pagination_class = ProductCursorPagination
    lookup_field = 'id'

    def handle_exception(self, exc):  # type: ignore[override]
        if isinstance(exc, serializers.ValidationError):
            status_code = status.HTTP_400_BAD_REQUEST
            codes = exc.get_codes()
            if _has_error_code(codes, 'unprocessable_entity'):
                status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
            return Response({'detail': 'Validation error', 'errors': exc.detail}, status=status_code)
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
                'detail': 'Slug already exists',
                'errors': {'seo': {'slug': ['Slug already exists']}},
            },
            status=status.HTTP_409_CONFLICT,
        )

    @staticmethod
    def _is_slug_conflict(exc: IntegrityError) -> bool:
        message = str(exc).lower()
        return 'seo_slug' in message or 'slug' in message

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
            queryset = queryset.filter(color=color)

        transport = request.query_params.get('transport_restriction')
        if transport:
            queryset = queryset.filter(delivery_transport_restriction=transport)

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

        serializer = ProductImageSerializer(created_images, many=True)
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
                return Response({'detail': 'Each entry must have id and position'}, status=status.HTTP_400_BAD_REQUEST)
            if str(item['id']) not in existing_ids:
                return Response({'detail': f"Image {item['id']} not found"}, status=status.HTTP_404_NOT_FOUND)
            try:
                position = int(item['position'])
            except (TypeError, ValueError):
                return Response({'detail': 'Position must be integer'}, status=status.HTTP_400_BAD_REQUEST)
            ProductImage.objects.filter(id=item['id'], product=product).update(position=position)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['delete'], url_path='images/(?P<image_id>[^/.]+)')
    def delete_image(self, request: Request, image_id: str, id=None):
        product = self.get_object()
        image = get_object_or_404(product.images, id=image_id)
        image.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CategoryTreeView(APIView):
    def get(self, request: Request):
        categories = Category.objects.all().order_by('name')
        tree = build_category_tree(list(categories))
        return Response(tree)


def build_category_tree(categories: list[Category], parent: Category | None = None) -> list[dict]:
    result: list[dict] = []
    for category in categories:
        if category.parent_id == (parent.id if parent else None):
            result.append(
                {
                    'id': str(category.id),
                    'name': category.name,
                    'slug': category.slug,
                    'children': build_category_tree(categories, category),
                }
            )
    return result


class ColorsListView(APIView):
    def get(self, request: Request):
        data = [{'value': choice.value, 'label': choice.label} for choice in Color]
        serializer = EnumChoiceSerializer(data, many=True)
        return Response(serializer.data)


class EnumsAggregateView(APIView):
    def get(self, request: Request):
        return Response(
            {
                'colors': [{'value': choice.value, 'label': choice.label} for choice in Color],
                'shapes': [{'value': choice.value, 'label': choice.label} for choice in DimensionShape],
                'transport_restrictions': [
                    {'value': choice.value, 'label': choice.label} for choice in TransportRestriction
                ],
                'installer_qualifications': [
                    {'value': choice.value, 'label': choice.label} for choice in InstallerQualification
                ],
                'reservation_modes': [
                    {'value': choice.value, 'label': choice.label} for choice in ReservationMode
                ],
                'rental_base_periods': [
                    {'value': choice.value, 'label': choice.label} for choice in RentalBasePeriod
                ],
            }
        )


__all__ = [
    'CategoryTreeView',
    'ColorsListView',
    'EnumsAggregateView',
    'ProductViewSet',
]

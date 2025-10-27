"""Serializers for product API."""

from __future__ import annotations

from collections.abc import Iterable
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Prefetch
from rest_framework import serializers

from .choices import (
    DimensionShape,
    InstallerQualification,
    RentalBasePeriod,
    ReservationMode,
    TransportRestriction,
)
from .models import Category, Product, ProductImage

DATETIME_FIELD = serializers.DateTimeField()


class EnumChoiceSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()


class ProductImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ('id', 'url', 'position')

    def get_url(self, obj: ProductImage) -> str:
        url = obj.url
        if not url:
            return ''
        request = self.context.get('request') if hasattr(self, 'context') else None
        if request is not None:
            return request.build_absolute_uri(url)
        return url


class ProductDimensionsSerializer(serializers.Serializer):
    shape = serializers.ChoiceField(choices=DimensionShape.choices)
    circle = serializers.DictField(
        child=serializers.DecimalField(max_digits=8, decimal_places=2), required=False
    )
    line = serializers.DictField(
        child=serializers.DecimalField(max_digits=8, decimal_places=2), required=False
    )
    rectangle = serializers.DictField(
        child=serializers.DecimalField(max_digits=8, decimal_places=2), required=False
    )
    cylinder = serializers.DictField(
        child=serializers.DecimalField(max_digits=8, decimal_places=2), required=False
    )
    box = serializers.DictField(
        child=serializers.DecimalField(max_digits=8, decimal_places=2), required=False
    )

    def validate(self, attrs):  # type: ignore[override]
        shape = attrs.get('shape')
        required_fields: dict[str, tuple[tuple[str, str], ...]] = {
            DimensionShape.CIRCLE_DIAMETER: (('circle', 'diameter_cm'),),
            DimensionShape.LINE_LENGTH: (('line', 'length_cm'),),
            DimensionShape.RECTANGLE_LENGTH_WIDTH: (
                ('rectangle', 'length_cm'),
                ('rectangle', 'width_cm'),
            ),
            DimensionShape.CYLINDER_DIAMETER_HEIGHT: (
                ('cylinder', 'diameter_cm'),
                ('cylinder', 'height_cm'),
            ),
            DimensionShape.BOX_HEIGHT_WIDTH_DEPTH: (
                ('box', 'height_cm'),
                ('box', 'width_cm'),
                ('box', 'depth_cm'),
            ),
        }
        requirements: Iterable[tuple[str, str]] = required_fields.get(shape, ())
        for container, field in requirements:
            data = attrs.get(container) or {}
            if field not in data:
                raise serializers.ValidationError(
                    {container: [f'Field "{field}" is required for shape {shape}.']},
                    code='unprocessable_entity',
                )
            value = data[field]
            if Decimal(value) <= 0:
                raise serializers.ValidationError(
                    {container: [f'Field "{field}" must be greater than 0.']},
                    code='unprocessable_entity',
                )
        return attrs


class ProductOccupancySerializer(serializers.Serializer):
    cleaning_days = serializers.IntegerField(min_value=0, required=False)
    insurance_reserve_percent = serializers.IntegerField(min_value=0, max_value=100, required=False)


class ProductDeliverySerializer(serializers.Serializer):
    volume_cm3 = serializers.IntegerField(min_value=1, required=False)
    weight_kg = serializers.DecimalField(max_digits=8, decimal_places=2, min_value=Decimal('0.01'))
    transport_restriction = serializers.ChoiceField(
        choices=TransportRestriction.choices,
        required=False,
    )
    self_pickup_allowed = serializers.BooleanField(required=False)


class ProductSetupSerializer(serializers.Serializer):
    install_minutes = serializers.IntegerField(min_value=0, required=False)
    uninstall_minutes = serializers.IntegerField(min_value=0, required=False)
    installer_qualification = serializers.ChoiceField(
        choices=InstallerQualification.choices,
        required=False,
    )
    min_installers = serializers.ChoiceField(
        choices=[(value, value) for value in range(1, 5)],
        required=False,
    )
    self_setup_allowed = serializers.BooleanField(required=False)


class ProductRentalSerializer(serializers.Serializer):
    base_period = serializers.ChoiceField(choices=RentalBasePeriod.choices, required=False)


class ProductVisibilitySerializer(serializers.Serializer):
    reservation_mode = serializers.ChoiceField(choices=ReservationMode.choices, required=False)
    show_on_pifakit = serializers.BooleanField(required=False)
    show_on_site = serializers.BooleanField(required=False)
    show_in_new = serializers.BooleanField(required=False)
    category_cover_on_home = serializers.BooleanField(required=False)


class ProductSeoSerializer(serializers.Serializer):
    slug = serializers.SlugField(required=False, allow_null=True, allow_blank=True)
    meta_title = serializers.CharField(required=False, allow_blank=True)
    meta_description = serializers.CharField(required=False, allow_blank=True)
    meta_keywords = serializers.ListField(
        child=serializers.CharField(allow_blank=False),
        required=False,
    )


class ProductBaseSerializer(serializers.ModelSerializer):
    price_rub = serializers.DecimalField(max_digits=12, decimal_places=2)
    loss_compensation_rub = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True,
    )
    features = serializers.ListField(child=serializers.CharField(), required=False)
    category_id = serializers.PrimaryKeyRelatedField(
        source='category', queryset=Category.objects.all(), write_only=True
    )
    category = serializers.PrimaryKeyRelatedField(read_only=True)
    dimensions = ProductDimensionsSerializer(write_only=True)
    occupancy = ProductOccupancySerializer(write_only=True, required=False)
    delivery = ProductDeliverySerializer(write_only=True, required=False)
    setup = ProductSetupSerializer(write_only=True, required=False)
    rental = ProductRentalSerializer(write_only=True, required=False)
    visibility = ProductVisibilitySerializer(write_only=True, required=False)
    seo = ProductSeoSerializer(write_only=True, required=False)
    complementary_product_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = Product
        fields = (
            'id',
            'name',
            'features',
            'category',
            'category_id',
            'complementary_product_ids',
            'price_rub',
            'loss_compensation_rub',
            'color',
            'dimensions',
            'occupancy',
            'delivery',
            'setup',
            'rental',
            'visibility',
            'seo',
            'created',
            'modified',
        )
        read_only_fields = ('id', 'created', 'modified', 'category')

    def validate(self, attrs):  # type: ignore[override]
        data = super().validate(attrs)
        dimensions = data.get('dimensions')
        delivery = data.get('delivery')
        product: Product | None = getattr(self, 'instance', None)

        computed_volume: int | None = None
        if dimensions:
            computed_volume = self._compute_volume(dimensions)
        if delivery:
            volume = delivery.get('volume_cm3')
            if not volume and computed_volume:
                delivery['volume_cm3'] = computed_volume
            elif not volume and computed_volume is None:
                raise serializers.ValidationError(
                    {
                        'delivery': {
                            'volume_cm3': ['volume_cm3 is required for selected dimensions']
                        }
                    },
                    code='unprocessable_entity',
                )
        elif computed_volume is not None:
            data.setdefault('delivery', {})['volume_cm3'] = computed_volume
        elif product and product.delivery_volume_cm3:
            # Keep existing volume if not provided and cannot be recomputed
            pass
        else:
            raise serializers.ValidationError(
                {'delivery': ['delivery block is required']},
                code='unprocessable_entity',
            )

        return data

    def _compute_volume(self, dimensions: dict) -> int | None:
        shape = dimensions['shape']
        if shape == DimensionShape.BOX_HEIGHT_WIDTH_DEPTH:
            box = dimensions.get('box') or {}
            try:
                return int(
                    Decimal(box['height_cm']) * Decimal(box['width_cm']) * Decimal(box['depth_cm'])
                )
            except (KeyError, TypeError, InvalidOperation):
                return None
        if shape == DimensionShape.CYLINDER_DIAMETER_HEIGHT:
            cylinder = dimensions.get('cylinder') or {}
            try:
                radius = Decimal(cylinder['diameter_cm']) / Decimal('2')
                base_area = Decimal('3.1415926535897932384626') * radius * radius
                return int(base_area * Decimal(cylinder['height_cm']))
            except (KeyError, TypeError, InvalidOperation):
                return None
        return None

    def create(self, validated_data):  # type: ignore[override]
        dimensions = validated_data.pop('dimensions')
        complementary_ids = validated_data.pop('complementary_product_ids', [])
        occupancy = validated_data.pop('occupancy', {}) or {}
        delivery = validated_data.pop('delivery', {}) or {}
        setup = validated_data.pop('setup', {}) or {}
        rental = validated_data.pop('rental', {}) or {}
        visibility = validated_data.pop('visibility', {}) or {}
        seo = validated_data.pop('seo', {}) or {}

        with transaction.atomic():
            product = Product.objects.create(**validated_data)
            self._apply_dimensions(product, dimensions)
            self._apply_occupancy(product, occupancy)
            self._apply_delivery(product, delivery)
            self._apply_setup(product, setup)
            self._apply_rental(product, rental)
            self._apply_visibility(product, visibility)
            self._apply_seo(product, seo)
            if complementary_ids:
                product.complementary_products.set(complementary_ids)
            product.save()
        return product

    def update(self, instance: Product, validated_data):  # type: ignore[override]
        dimensions = validated_data.pop('dimensions', None)
        complementary_ids = validated_data.pop('complementary_product_ids', None)
        occupancy = validated_data.pop('occupancy', None)
        delivery = validated_data.pop('delivery', None)
        setup = validated_data.pop('setup', None)
        rental = validated_data.pop('rental', None)
        visibility = validated_data.pop('visibility', None)
        seo = validated_data.pop('seo', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if dimensions is not None:
            self._apply_dimensions(instance, dimensions)
        if occupancy is not None:
            self._apply_occupancy(instance, occupancy)
        if delivery is not None:
            self._apply_delivery(instance, delivery)
        if setup is not None:
            self._apply_setup(instance, setup)
        if rental is not None:
            self._apply_rental(instance, rental)
        if visibility is not None:
            self._apply_visibility(instance, visibility)
        if seo is not None:
            self._apply_seo(instance, seo)
        if complementary_ids is not None:
            instance.complementary_products.set(complementary_ids)

        instance.save()
        return instance

    def to_representation(self, instance: Product):  # type: ignore[override]
        data = super().to_representation(instance)
        include = set(self.context.get('include', ()))
        if 'dimensions' in include or self.context.get('detail'):  # always include on detail
            data['dimensions'] = serialize_dimensions(instance)
        if 'occupancy' in include or self.context.get('detail'):
            data['occupancy'] = serialize_occupancy(instance)
        if 'delivery' in include or self.context.get('detail'):
            data['delivery'] = serialize_delivery(instance)
        if 'setup' in include or self.context.get('detail'):
            data['setup'] = serialize_setup(instance)
        if 'rental' in include or self.context.get('detail'):
            data['rental'] = serialize_rental(instance)
        if 'visibility' in include or self.context.get('detail'):
            data['visibility'] = serialize_visibility(instance)
        if 'seo' in include or self.context.get('detail'):
            data['seo'] = serialize_seo(instance)
        if 'images' in include or self.context.get('detail'):
            data['images'] = ProductImageSerializer(
                instance.images.all(),
                many=True,
                context=self.context,
            ).data
        data['category_id'] = str(instance.category_id)
        data['created_at'] = DATETIME_FIELD.to_representation(instance.created)
        data['updated_at'] = DATETIME_FIELD.to_representation(instance.modified)
        if data.get('price_rub') is not None:
            data['price_rub'] = decimal_to_float(data['price_rub'])
        if data.get('loss_compensation_rub') is not None:
            data['loss_compensation_rub'] = decimal_to_float(data['loss_compensation_rub'])
        data['complementary_product_ids'] = [
            str(product_id)
            for product_id in instance.complementary_products.values_list('id', flat=True)
        ]
        if 'complementary_products' in include or self.context.get('detail'):
            data['complementary_products'] = serialize_complementary_products(instance)
        data.pop('created', None)
        data.pop('modified', None)
        data.pop('category', None)
        return data

    # helpers -----------------------------------------------------------------

    def _apply_dimensions(self, product: Product, dimensions: dict) -> None:
        product.dimensions_shape = dimensions['shape']
        product.circle_diameter_cm = (dimensions.get('circle') or {}).get('diameter_cm')
        product.line_length_cm = (dimensions.get('line') or {}).get('length_cm')
        product.rectangle_length_cm = (dimensions.get('rectangle') or {}).get('length_cm')
        product.rectangle_width_cm = (dimensions.get('rectangle') or {}).get('width_cm')
        product.cylinder_diameter_cm = (dimensions.get('cylinder') or {}).get('diameter_cm')
        product.cylinder_height_cm = (dimensions.get('cylinder') or {}).get('height_cm')
        product.box_height_cm = (dimensions.get('box') or {}).get('height_cm')
        product.box_width_cm = (dimensions.get('box') or {}).get('width_cm')
        product.box_depth_cm = (dimensions.get('box') or {}).get('depth_cm')

    def _apply_occupancy(self, product: Product, occupancy: dict) -> None:
        product.occupancy_cleaning_days = occupancy.get('cleaning_days')
        product.occupancy_insurance_reserve_percent = occupancy.get('insurance_reserve_percent')

    def _apply_delivery(self, product: Product, delivery: dict) -> None:
        product.delivery_volume_cm3 = delivery.get('volume_cm3')
        product.delivery_weight_kg = delivery.get('weight_kg')
        product.delivery_transport_restriction = delivery.get('transport_restriction') or ''
        product.delivery_self_pickup_allowed = delivery.get('self_pickup_allowed', False)

    def _apply_setup(self, product: Product, setup: dict) -> None:
        product.setup_install_minutes = setup.get('install_minutes')
        product.setup_uninstall_minutes = setup.get('uninstall_minutes')
        product.setup_installer_qualification = setup.get('installer_qualification') or ''
        product.setup_min_installers = setup.get('min_installers')
        product.setup_self_setup_allowed = setup.get('self_setup_allowed', False)

    def _apply_rental(self, product: Product, rental: dict) -> None:
        product.rental_base_period = rental.get('base_period') or ''

    def _apply_visibility(self, product: Product, visibility: dict) -> None:
        product.visibility_reservation_mode = visibility.get('reservation_mode') or ''
        product.visibility_show_on_pifakit = visibility.get('show_on_pifakit', False)
        product.visibility_show_on_site = visibility.get('show_on_site', False)
        product.visibility_show_in_new = visibility.get('show_in_new', False)
        product.visibility_category_cover_on_home = visibility.get('category_cover_on_home', False)

    def _apply_seo(self, product: Product, seo: dict) -> None:
        product.seo_slug = seo.get('slug') or None
        product.seo_meta_title = seo.get('meta_title', '')
        product.seo_meta_description = seo.get('meta_description', '')
        product.seo_meta_keywords = seo.get('meta_keywords') or []


class ProductDetailSerializer(ProductBaseSerializer):
    images = ProductImageSerializer(many=True, read_only=True)

    class Meta(ProductBaseSerializer.Meta):
        fields = ProductBaseSerializer.Meta.fields + ('images',)
        read_only_fields = ProductBaseSerializer.Meta.read_only_fields + ('images',)

    def to_representation(self, instance):  # type: ignore[override]
        self.context.setdefault('detail', True)
        return super().to_representation(instance)


class ProductListItemSerializer(serializers.ModelSerializer):
    thumbnail_url = serializers.SerializerMethodField()
    delivery = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            'id',
            'name',
            'price_rub',
            'color',
            'category_id',
            'thumbnail_url',
            'delivery',
        )

    def get_thumbnail_url(self, obj: Product) -> str | None:
        thumbnail = obj.thumbnail
        return thumbnail.url if thumbnail else None

    def get_delivery(self, obj: Product) -> dict:
        return {
            'transport_restriction': obj.delivery_transport_restriction or None,
            'self_pickup_allowed': obj.delivery_self_pickup_allowed,
        }

    def to_representation(self, instance: Product):  # type: ignore[override]
        data = super().to_representation(instance)
        include = set(self.context.get('include', ()))
        if 'dimensions' in include:
            data['dimensions'] = serialize_dimensions(instance)
        if 'seo' in include:
            data['seo'] = serialize_seo(instance)
        if 'images' in include:
            data['images'] = ProductImageSerializer(
                instance.images.all(),
                many=True,
                context=self.context,
            ).data
        if data.get('price_rub') is not None:
            data['price_rub'] = decimal_to_float(data['price_rub'])
        if data.get('category_id') is not None:
            data['category_id'] = str(data['category_id'])
        return data


def serialize_dimensions(product: Product) -> dict:
    data = {'shape': product.dimensions_shape}
    if product.dimensions_shape == DimensionShape.CIRCLE_DIAMETER:
        data['circle'] = {'diameter_cm': decimal_to_float(product.circle_diameter_cm)}
    if product.dimensions_shape == DimensionShape.LINE_LENGTH:
        data['line'] = {'length_cm': decimal_to_float(product.line_length_cm)}
    if product.dimensions_shape == DimensionShape.RECTANGLE_LENGTH_WIDTH:
        data['rectangle'] = {
            'length_cm': decimal_to_float(product.rectangle_length_cm),
            'width_cm': decimal_to_float(product.rectangle_width_cm),
        }
    if product.dimensions_shape == DimensionShape.CYLINDER_DIAMETER_HEIGHT:
        data['cylinder'] = {
            'diameter_cm': decimal_to_float(product.cylinder_diameter_cm),
            'height_cm': decimal_to_float(product.cylinder_height_cm),
        }
    if product.dimensions_shape == DimensionShape.BOX_HEIGHT_WIDTH_DEPTH:
        data['box'] = {
            'height_cm': decimal_to_float(product.box_height_cm),
            'width_cm': decimal_to_float(product.box_width_cm),
            'depth_cm': decimal_to_float(product.box_depth_cm),
        }
    return data


def serialize_occupancy(product: Product) -> dict:
    return {
        'cleaning_days': product.occupancy_cleaning_days,
        'insurance_reserve_percent': product.occupancy_insurance_reserve_percent,
    }


def serialize_delivery(product: Product) -> dict:
    return {
        'volume_cm3': product.delivery_volume_cm3,
        'weight_kg': decimal_to_float(product.delivery_weight_kg),
        'transport_restriction': product.delivery_transport_restriction or None,
        'self_pickup_allowed': product.delivery_self_pickup_allowed,
    }


def serialize_setup(product: Product) -> dict:
    return {
        'install_minutes': product.setup_install_minutes,
        'uninstall_minutes': product.setup_uninstall_minutes,
        'installer_qualification': product.setup_installer_qualification or None,
        'min_installers': product.setup_min_installers,
        'self_setup_allowed': product.setup_self_setup_allowed,
    }


def serialize_rental(product: Product) -> dict:
    return {'base_period': product.rental_base_period or None}


def serialize_visibility(product: Product) -> dict:
    return {
        'reservation_mode': product.visibility_reservation_mode or None,
        'show_on_pifakit': product.visibility_show_on_pifakit,
        'show_on_site': product.visibility_show_on_site,
        'show_in_new': product.visibility_show_in_new,
        'category_cover_on_home': product.visibility_category_cover_on_home,
    }


def serialize_seo(product: Product) -> dict:
    return {
        'slug': product.seo_slug,
        'meta_title': product.seo_meta_title,
        'meta_description': product.seo_meta_description,
        'meta_keywords': product.seo_meta_keywords,
    }


def serialize_complementary_products(product: Product) -> list[dict]:
    return [
        {
            'id': str(complementary.id),
            'name': complementary.name,
        }
        for complementary in product.complementary_products.all()
    ]


def decimal_to_float(value):
    if value in (None, ''):
        return None
    try:
        return float(Decimal(str(value)))
    except (InvalidOperation, TypeError, ValueError):
        return value


def prefetch_for_include(include: Iterable[str]):
    prefetches = []
    if 'images' in include:
        prefetches.append(Prefetch('images', queryset=ProductImage.objects.order_by('position')))
    if 'complementary_products' in include:
        prefetches.append(
            Prefetch(
                'complementary_products',
                queryset=Product.objects.only('id', 'name'),
            )
        )
    return prefetches


__all__ = [
    'EnumChoiceSerializer',
    'ProductBaseSerializer',
    'ProductDetailSerializer',
    'ProductImageSerializer',
    'ProductListItemSerializer',
    'prefetch_for_include',
    'serialize_delivery',
    'serialize_dimensions',
    'serialize_occupancy',
    'serialize_complementary_products',
    'serialize_rental',
    'serialize_seo',
    'serialize_setup',
    'serialize_visibility',
]

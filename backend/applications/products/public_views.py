from __future__ import annotations

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from applications.products.models import Category


def _serialize_category(category: Category) -> dict[str, str | None]:
    image_url = category.image.url if category.image else None
    return {
        'id': str(category.id),
        'name': category.name,
        'slug': category.slug,
        'image': image_url,
    }


@api_view(['GET'])
@permission_classes([AllowAny])
def catalogue(request):
    """Return full catalogue with categories and cover images."""

    categories = Category.objects.order_by('name')
    return Response({'data': [_serialize_category(category) for category in categories]})

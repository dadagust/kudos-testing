"""Custom storage backends for product-related files."""

from django.conf import settings
from django.core.files.storage import FileSystemStorage


product_image_storage = FileSystemStorage(
    base_url=settings.PRODUCTS_MEDIA_URL,
)

__all__ = ['product_image_storage']

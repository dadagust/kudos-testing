"""Main URL configuration for the project."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve as serve_static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('core/', include('applications.system.urls')),
    path('api/v1/', include('applications.customers.urls')),
    path('api/v1/', include('applications.orders.urls')),
    path('api/v1/', include('applications.products.urls')),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.PRODUCTS_MEDIA_URL,
        document_root=settings.PRODUCTS_MEDIA_ROOT,
    )
else:
    products_prefix = settings.PRODUCTS_MEDIA_URL.lstrip('/')
    if products_prefix.endswith('/'):
        products_prefix = products_prefix[:-1]
    if products_prefix:
        urlpatterns.append(
            re_path(
                rf'^{products_prefix}/(?P<path>.+)$',
                serve_static,
                kwargs={'document_root': settings.PRODUCTS_MEDIA_ROOT},
            )
        )

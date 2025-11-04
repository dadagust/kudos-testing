"""Main URL configuration for the project."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from applications.common.url_utils import allow_optional_trailing_slash

urlpatterns = allow_optional_trailing_slash(
    [
        path('admin/', admin.site.urls),
        path('core/', include('applications.system.urls')),
        path(
            'api/v1/',
            include(
                [
                    path('', include('applications.customers.urls')),
                    path('', include('applications.orders.urls')),
                    path('', include('applications.products.urls')),
                ]
            ),
        ),
    ]
)

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

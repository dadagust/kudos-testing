"""Main URL configuration for the project."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('core/', include('applications.core.urls')),
    path('api/v1/', include('applications.customers.urls')),
    path('api/v1/', include('applications.orders.urls')),
]

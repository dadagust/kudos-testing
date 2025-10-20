from django.urls import include, path, re_path

from applications.orders.public_views import product_detail, product_list

from .views import ping

urlpatterns = [
    path('ping/', ping, name='ping'),
    path('auth/', include('applications.users.urls')),
    path('logs/', include('applications.audit.urls')),
    re_path(r'^products/?$', product_list, name='product-list'),
    re_path(r'^products/(?P<product_id>[^/]+)/?$', product_detail, name='product-detail'),
]

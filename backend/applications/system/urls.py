from django.urls import include, path, re_path

from applications.common.url_utils import allow_optional_trailing_slash
from applications.orders.public_views import (
    create_customer_order,
    product_detail,
    product_list,
)
from applications.products.public_views import catalogue
from applications.orders.views import YandexSuggestView

from .views import ping

urlpatterns = allow_optional_trailing_slash(
    [
        path('ping/', ping, name='ping'),
        path('auth/', include('applications.users.urls')),
        path('logs/', include('applications.audit.urls')),
        path('orders/', create_customer_order, name='customer-order-create'),
        path('catalogue/', catalogue, name='catalogue-list'),
        re_path(r'^products/?$', product_list, name='product-list'),
        re_path(r'^products/(?P<product_id>[^/]+)/?$', product_detail, name='product-detail'),
        path('ymaps/suggest/', YandexSuggestView.as_view(), name='ymaps-suggest-public'),
    ]
)

"""URL routing for order API."""

from rest_framework.routers import DefaultRouter

from .views import OrderViewSet

app_name = 'orders'


router = DefaultRouter(trailing_slash='/?')
router.register('order', OrderViewSet, basename='order')

urlpatterns = router.urls

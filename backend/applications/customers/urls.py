"""URL routing for customer API."""

from rest_framework.routers import DefaultRouter

from .views import CustomerViewSet

app_name = 'customers'


router = DefaultRouter(trailing_slash='/?')
router.register('customer', CustomerViewSet, basename='customer')

urlpatterns = router.urls

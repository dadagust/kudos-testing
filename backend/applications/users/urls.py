from rest_framework.routers import DefaultRouter

from .views import AuthViewSet

app_name = 'users'


router = DefaultRouter(trailing_slash='/?')
router.register('', AuthViewSet, basename='auth')

urlpatterns = router.urls

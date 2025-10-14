from django.urls import include, path

from .views import ping

urlpatterns = [
    path('ping/', ping, name='ping'),
    path('auth/', include('applications.users.urls')),
    path('logs/', include('applications.audit.urls')),
]

"""Application configuration split out for clarity."""

DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'corsheaders',
    'auditlog',
]

LOCAL_APPS = [
    'applications.core',
    'applications.users',
    'applications.audit',
    'applications.system',
    'applications.customers',
    'applications.orders',
    'applications.products',
    'applications.logistics',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

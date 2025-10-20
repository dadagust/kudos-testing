# settings/base.py

"""Base settings shared across environments."""

from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
)

ENV_FILE = BASE_DIR / 'config' / '.env.local'
EXAMPLE_ENV_FILE = BASE_DIR / 'config' / '.env.local.example'
if ENV_FILE.exists():
    environ.Env.read_env(ENV_FILE)
elif EXAMPLE_ENV_FILE.exists():
    environ.Env.read_env(EXAMPLE_ENV_FILE)

SECRET_KEY = env('DJANGO_SECRET_KEY', default='change-me')
DEBUG = env.bool('DJANGO_DEBUG', default=False)
ALLOWED_HOSTS = env.list('DJANGO_ALLOWED_HOSTS', default=['localhost'])

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'kudos',
        'USER': 'kudos',
        'PASSWORD': 'kudos',
        'HOST': 'localhost',
        'PORT': '5432',
        'CONN_MAX_AGE': 60,
    }
}

database_url = env.db('DATABASE_URL', default=None)
if database_url:
    DATABASES['default'].update(database_url)

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'auditlog.middleware.AuditlogMiddleware',
]

ROOT_URLCONF = 'settings.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'settings.wsgi.application'
ASGI_APPLICATION = 'settings.asgi.application'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'ru-ru'
TIME_ZONE = 'Europe/Moscow'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

"""REST framework and authentication settings."""

from datetime import timedelta

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.AllowAny',),
    'DEFAULT_PAGINATION_CLASS': 'applications.common.pagination.DefaultPagination',
    'DATE_FORMAT': '%d/%m/%Y',
    'DATETIME_FORMAT': '%d/%m/%Y %H:%M',
    'DATE_INPUT_FORMATS': ['%d/%m/%Y', '%d.%m.%Y', 'iso-8601'],
    'DATETIME_INPUT_FORMATS': [
        '%d/%m/%Y %H:%M',
        '%d/%m/%Y %H:%M:%S',
        '%d.%m.%Y %H:%M',
        '%d.%m.%Y %H:%M:%S',
        'iso-8601',
    ],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

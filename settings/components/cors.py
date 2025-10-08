"""CORS configuration extracted to a separate component."""

from corsheaders.defaults import default_headers

from settings.components.base import env

CORS_ALLOW_CREDENTIALS = True

cors_origins = env.list('DJANGO_CORS_ORIGINS', default=[])
if not cors_origins:
    cors_origins = ['http://localhost:3000', 'http://127.0.0.1:3000']

CORS_ALLOWED_ORIGINS = cors_origins
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS
CORS_ALLOW_HEADERS = list(default_headers) + ['x-trace-id']

"""Project settings assembled from multiple components."""

from split_settings.tools import include, optional

include(
    'components/apps.py',
    'components/base.py',
    'components/rest.py',
    'components/cors.py',
    optional('local_settings.py'),
)

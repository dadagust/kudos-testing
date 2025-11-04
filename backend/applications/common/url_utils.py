"""Utilities for working with Django URL patterns."""

from __future__ import annotations

from collections.abc import Iterable

from django.urls import URLPattern, URLResolver, include, path

__all__ = ['allow_optional_trailing_slash']


ExpandedPatternList = list[URLPattern | URLResolver]


def allow_optional_trailing_slash(
    patterns: Iterable[URLPattern | URLResolver],
) -> ExpandedPatternList:
    """Return URL patterns that accept both with and without trailing slashes."""
    expanded: ExpandedPatternList = []

    for pattern in patterns:
        expanded.append(pattern)

        if isinstance(pattern, URLPattern):
            route = getattr(pattern.pattern, '_route', None)
            if not route or not route.endswith('/'):
                continue

            slashless_route = route[:-1]
            if not slashless_route:
                continue

            if any(
                isinstance(existing, URLPattern)
                and getattr(existing.pattern, '_route', None) == slashless_route
                for existing in expanded
            ):
                continue

            expanded.append(
                path(
                    slashless_route,
                    pattern.callback,
                    kwargs=pattern.default_args,
                    name=pattern.name,
                )
            )
        elif isinstance(pattern, URLResolver):
            route = getattr(pattern.pattern, '_route', None)
            if not route or not route.endswith('/'):
                continue

            slashless_route = route[:-1]
            if not slashless_route:
                continue

            if any(
                isinstance(existing, URLResolver)
                and getattr(existing.pattern, '_route', None) == slashless_route
                for existing in expanded
            ):
                continue

            include_arg: str | tuple[str, str] = pattern.urlconf_name
            if pattern.app_name:
                include_arg = (pattern.urlconf_name, pattern.app_name)

            expanded.append(
                path(
                    slashless_route,
                    include(include_arg, namespace=pattern.namespace)
                    if pattern.namespace
                    else include(include_arg),
                    kwargs=pattern.default_kwargs,
                )
            )

    return expanded

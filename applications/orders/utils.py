"""Utility helpers for order API."""

from __future__ import annotations

from datetime import date

from django.utils.dateparse import parse_date
from rest_framework import exceptions


class OrderQueryParamsHelper:
    """Parse and normalize query parameters for the order endpoints."""

    def __init__(self, request):
        self.params = request.query_params

    def get_scope(self) -> str:
        value = self.params.get('scope') or self.params.get('filter[scope]')
        return (value or 'current').strip().lower()

    def get_status(self) -> str:
        value = self.params.get('status') or self.params.get('filter[status]')
        return value.strip() if value else ''

    def get_search(self) -> str:
        value = self.params.get('search') or self.params.get('q')
        return value.strip() if value else ''

    def get_customer_id(self) -> str:
        value = self.params.get('customer') or self.params.get('filter[customer]')
        return value.strip() if value else ''

    def get_date(self, key: str) -> date | None:
        raw = self.params.get(key) or self.params.get(f'filter[{key}]')
        if not raw:
            return None
        value = parse_date(raw)
        if value is None:
            raise exceptions.ValidationError({key: 'Некорректная дата'})
        return value


__all__ = ['OrderQueryParamsHelper']

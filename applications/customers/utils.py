"""Utility helpers for customer API."""

from __future__ import annotations

from datetime import datetime, time
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import exceptions


class QueryParamsHelper:
    """Small helper encapsulating filter/search/sort parsing."""

    def __init__(self, request):
        self.request = request
        self.params = request.query_params

    def get_search(self) -> str:
        value = self.params.get('search') or self.params.get('q')
        return value.strip() if value else ''

    def get_filter(self, name: str) -> str:
        keys = [f'filter[{name}]', name]
        for key in keys:
            value = self.params.get(key)
            if value is not None:
                value = value.strip()
                if value:
                    return value
        return ''

    def get_filter_list(self, name: str) -> list[str]:
        key = f'filter[{name}]'
        values = self.params.getlist(key)
        if values:
            return [value.strip() for value in values if value.strip()]
        single = self.get_filter(name)
        return [single] if single else []

    def get_filter_datetime(self, field: str, bound: str):
        key = f'filter[{field}][{bound}]'
        raw = self.params.get(key)
        if not raw:
            return None
        value = parse_datetime(raw)
        if value is not None:
            if timezone.is_naive(value):
                value = timezone.make_aware(value, timezone=timezone.utc)
            return value
        date_value = parse_date(raw)
        if date_value is None:
            raise exceptions.ValidationError({key: 'Некорректный формат даты'})
        if bound == 'to':
            return timezone.make_aware(datetime.combine(date_value, time.max), timezone=timezone.utc)
        return timezone.make_aware(datetime.combine(date_value, time.min), timezone=timezone.utc)

    def get_sort_fields(self, mapping: dict[str, str]) -> list[str]:
        sort_param = self.params.get('sort')
        if not sort_param:
            return []
        fields: list[str] = []
        for raw_field in sort_param.split(','):
            raw_field = raw_field.strip()
            if not raw_field:
                continue
            direction = '-' if raw_field.startswith('-') else ''
            field_key = raw_field[1:] if direction else raw_field
            mapped = mapping.get(field_key)
            if not mapped:
                raise exceptions.ValidationError(
                    {
                        'sort': f'Недопустимое поле сортировки: {field_key}',
                    }
                )
            fields.append(f'{direction}{mapped}')
        return fields

__all__ = ['QueryParamsHelper']

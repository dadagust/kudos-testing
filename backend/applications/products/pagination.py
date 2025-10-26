"""Cursor pagination tuned for the products API contract."""

from urllib.parse import parse_qs, urlparse

from rest_framework.pagination import CursorPagination
from rest_framework.response import Response


class ProductCursorPagination(CursorPagination):
    page_size = 20
    page_size_query_param = 'limit'
    max_page_size = 100
    cursor_query_param = 'cursor'
    ordering = '-created'

    def get_paginated_response(self, data):  # type: ignore[override]
        return Response({'results': data, 'next_cursor': self.get_next_cursor_value()})

    def get_next_cursor_value(self):
        next_link = self.get_next_link()
        if not next_link:
            return None
        query = urlparse(next_link).query
        params = parse_qs(query)
        cursor_values = params.get(self.cursor_query_param)
        return cursor_values[0] if cursor_values else None


__all__ = ['ProductCursorPagination']

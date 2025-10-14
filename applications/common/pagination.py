"""Custom pagination that matches API conventions."""

from __future__ import annotations

from django.core.paginator import InvalidPage
from rest_framework.exceptions import NotFound
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class DefaultPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

    def paginate_queryset(self, queryset, request, view=None):  # type: ignore[override]
        page_size = self.get_page_size(request)
        if not page_size:
            return None

        paginator = self.django_paginator_class(queryset, page_size)
        page_number = request.query_params.get(self.page_query_param, 1)
        if page_number in self.last_page_strings:
            page_number = paginator.num_pages

        try:
            self.page = paginator.page(page_number)
        except InvalidPage as exc:
            try:
                page_number_int = int(page_number)
            except (TypeError, ValueError):
                page_number_int = None

            if page_number_int == 1 and paginator.count == 0:
                self.page = paginator._get_page([], 1, paginator)
            else:
                msg = self.invalid_page_message.format(page_number=page_number, message=str(exc))
                raise NotFound(msg)

        if paginator.num_pages > 1 and self.template is not None:
            self.display_page_controls = True

        self.request = request
        return list(self.page)

    def get_paginated_response(self, data):  # type: ignore[override]
        request = self.request
        assert request is not None

        links = {
            'self': request.build_absolute_uri(),
            'first': self._build_link(1),
            'last': self._build_link(self.page.paginator.num_pages or 1),
            'next': self.get_next_link(),
            'prev': self.get_previous_link(),
        }
        pagination = {
            'page': self.page.number,
            'page_size': self.get_page_size(request),
            'total_items': self.page.paginator.count,
            'total_pages': self.page.paginator.num_pages,
            'has_next': self.page.has_next(),
            'has_prev': self.page.has_previous(),
        }
        return Response({'data': data, 'meta': {'pagination': pagination}, 'links': links})

    def get_next_link(self):  # type: ignore[override]
        if not self.page.has_next():
            return None
        page_number = self.page.next_page_number()
        return self._build_link(page_number)

    def get_previous_link(self):  # type: ignore[override]
        if not self.page.has_previous():
            return None
        page_number = self.page.previous_page_number()
        return self._build_link(page_number)

    def _build_link(self, page_number: int) -> str:
        request = self.request
        assert request is not None
        query_params = request.query_params.copy()
        query_params['page'] = page_number
        return request.build_absolute_uri(f'?{query_params.urlencode()}')


__all__ = ['DefaultPagination']

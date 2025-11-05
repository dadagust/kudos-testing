import { NextRequest, NextResponse } from 'next/server';

import { formatDateTimeDisplay, toTimestamp } from '@/shared/lib/date';

import {
  AVAILABILITY_STATUSES,
  AvailabilityStatus,
  CategorySummary,
  PRODUCTS,
  PRODUCT_STATUSES,
  ProductEntity,
  ProductStatus,
} from './data';

const statusLabels: Record<ProductStatus, string> = {
  active: 'Активен',
  draft: 'Черновик',
  archived: 'Архив',
};

const availabilityLabels: Record<AvailabilityStatus, string> = {
  in_stock: 'В наличии',
  reserved: 'В резерве',
  out_of_stock: 'Нет в наличии',
};

const toTraceId = () =>
  `trace_${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16)}`;

const getUniqueCategories = (items: ProductEntity[]): CategorySummary[] => {
  const map = new Map<string, CategorySummary>();
  items.forEach((product) => {
    if (!map.has(product.category.id)) {
      map.set(product.category.id, product.category);
    }
  });
  return Array.from(map.values());
};

const applySearch = (items: ProductEntity[], search: string | null): ProductEntity[] => {
  if (!search) {
    return items;
  }
  const term = search.trim().toLowerCase();
  if (!term) {
    return items;
  }

  return items.filter((item) => {
    const haystack = [item.name, item.sku, item.category.name];
    return haystack.some((value) => value.toLowerCase().includes(term));
  });
};

const applyFilters = (
  items: ProductEntity[],
  filters: {
    status?: string | null;
    category?: string | null;
    availability?: string | null;
  }
): ProductEntity[] =>
  items.filter((item) => {
    if (filters.status && item.status !== filters.status) {
      return false;
    }
    if (filters.category && item.category.id !== filters.category) {
      return false;
    }
    if (filters.availability && item.availability_status !== filters.availability) {
      return false;
    }
    return true;
  });

const applySort = (items: ProductEntity[], sort: string | null): ProductEntity[] => {
  const sortKeyRaw = sort ?? '-updated_at';
  const direction = sortKeyRaw.startsWith('-') ? -1 : 1;
  const sortKey = sortKeyRaw.startsWith('-') ? sortKeyRaw.slice(1) : sortKeyRaw;

  const sorted = [...items];
  sorted.sort((a, b) => {
    if (sortKey === 'name') {
      return a.name.localeCompare(b.name) * direction;
    }
    if (sortKey === 'base_price') {
      return (a.base_price - b.base_price) * direction;
    }
    if (sortKey === 'updated_at') {
      const aTime = toTimestamp(a.updated_at);
      const bTime = toTimestamp(b.updated_at);
      if (aTime === null && bTime === null) {
        return 0;
      }
      if (aTime === null) {
        return 1;
      }
      if (bTime === null) {
        return -1;
      }
      return (aTime - bTime) * direction;
    }
    return 0;
  });

  return sorted;
};

const paginate = (items: ProductEntity[], page: number, pageSize: number) => {
  const totalItems = items.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    meta: {
      pagination: {
        page: safePage,
        page_size: pageSize,
        total_items: totalItems,
        total_pages: totalPages,
        has_next: totalPages > 0 && safePage < totalPages,
        has_prev: totalPages > 0 && safePage > 1,
      },
    },
  } as const;
};

export function GET(request: NextRequest) {
  const url = request.nextUrl;
  const search = url.searchParams.get('search');
  const status = url.searchParams.get('status');
  const category = url.searchParams.get('category_id');
  const availability = url.searchParams.get('availability_status');
  const sort = url.searchParams.get('sort');
  const page = Number(url.searchParams.get('page') ?? '1');
  const pageSize = Number(url.searchParams.get('page_size') ?? '10');

  const base = applySearch(PRODUCTS, search);
  const filtered = applyFilters(base, { status, category, availability });
  const sorted = applySort(filtered, sort);
  const { items, meta } = paginate(
    sorted,
    Number.isFinite(page) ? page : 1,
    Number.isFinite(pageSize) ? pageSize : 10
  );

  const categories = getUniqueCategories(PRODUCTS);
  const traceId = toTraceId();

  const response = NextResponse.json(
    {
      data: items.map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        status: product.status,
        availability_status: product.availability_status,
        rental_unit: product.rental_unit,
        base_price: product.base_price,
        security_deposit: product.security_deposit,
        short_description: product.short_description,
        updated_at: formatDateTimeDisplay(product.updated_at) ?? product.updated_at,
      })),
      meta,
      filters: {
        statuses: PRODUCT_STATUSES.map((statusValue) => ({
          value: statusValue,
          label: statusLabels[statusValue],
        })),
        availability_statuses: AVAILABILITY_STATUSES.map((availabilityValue) => ({
          value: availabilityValue,
          label: availabilityLabels[availabilityValue],
        })),
        categories,
        sort: [
          { value: '-updated_at', label: 'Обновлено (сначала новые)' },
          { value: 'updated_at', label: 'Обновлено (сначала старые)' },
          { value: 'name', label: 'Название (А-Я)' },
          { value: '-name', label: 'Название (Я-А)' },
          { value: 'base_price', label: 'Цена (возр.)' },
          { value: '-base_price', label: 'Цена (убыв.)' },
        ],
      },
      trace_id: traceId,
    },
    { status: 200 }
  );

  response.headers.set('x-trace-id', traceId);

  return response;
}

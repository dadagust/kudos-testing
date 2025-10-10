'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';

import {
  AVAILABILITY_STATUS_LABELS,
  PRODUCT_STATUS_LABELS,
  RENTAL_UNIT_LABELS,
  useProductsQuery,
} from '@/entities/product';
import type { ProductListQuery, ProductSummary } from '@/entities/product';
import { RoleGuard } from '@/features/auth';
import { Alert, Badge, Button, Input, Pagination, Select, Spinner, Tag, Table } from '@/shared/ui';
import type { TableColumn } from '@/shared/ui';

const formatCurrency = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
  active: 'success',
  draft: 'warning',
  archived: 'info',
};

const AVAILABILITY_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
  in_stock: 'success',
  reserved: 'warning',
  out_of_stock: 'danger',
};

const DEFAULT_PAGE_SIZE = 10;

export default function ProductsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState<ProductListQuery['status']>('');
  const [category, setCategory] = useState('');
  const [availability, setAvailability] = useState<ProductListQuery['availability_status']>('');
  const [sort, setSort] = useState<ProductListQuery['sort']>('-updated_at');
  const [page, setPage] = useState(1);

  const queryParams = useMemo<ProductListQuery>(
    () => ({
      search: searchTerm || undefined,
      status: status || undefined,
      category_id: category || undefined,
      availability_status: availability || undefined,
      sort,
      page,
      page_size: DEFAULT_PAGE_SIZE,
    }),
    [availability, category, page, searchTerm, sort, status]
  );

  const { data, isLoading, isError, error, isFetching } = useProductsQuery(queryParams);

  const rows: ProductSummary[] = data?.data ?? [];
  const filters = data?.filters;
  const pagination = data?.meta.pagination;

  const columns: TableColumn<ProductSummary>[] = [
    { key: 'sku', header: 'Артикул' },
    {
      key: 'name',
      header: 'Название',
      render: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <strong>{row.name}</strong>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            {row.short_description}
          </span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Категория',
      render: (row) => row.category.name,
    },
    {
      key: 'status',
      header: 'Статус',
      render: (row) => (
        <Badge tone={STATUS_TONE[row.status] ?? 'info'}>{PRODUCT_STATUS_LABELS[row.status]}</Badge>
      ),
    },
    {
      key: 'availability_status',
      header: 'Наличие',
      render: (row) => (
        <Badge tone={AVAILABILITY_TONE[row.availability_status] ?? 'info'}>
          {AVAILABILITY_STATUS_LABELS[row.availability_status]}
        </Badge>
      ),
    },
    {
      key: 'base_price',
      header: 'Базовая цена',
      render: (row) => formatCurrency.format(row.base_price),
    },
    {
      key: 'rental_unit',
      header: 'Ед. аренды',
      render: (row) => RENTAL_UNIT_LABELS[row.rental_unit],
    },
    {
      key: 'updated_at',
      header: 'Обновлено',
      render: (row) => formatDateTime(row.updated_at),
    },
    {
      key: 'actions',
      header: ' ',
      render: (row) => (
        <Link href={`/products/${row.id}`}>
          <Button variant="ghost" iconLeft="info">
            Подробнее
          </Button>
        </Link>
      ),
    },
  ];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchTerm(searchInput);
    setPage(1);
  };

  const handleReset = () => {
    setSearchInput('');
    setSearchTerm('');
    setStatus('');
    setCategory('');
    setAvailability('');
    setSort('-updated_at');
    setPage(1);
  };

  return (
    <RoleGuard section="products">
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '24px',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h1>Каталог товаров</h1>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '48rem' }}>
            Управляйте ассортиментом, фильтруйте по статусу и категории, просматривайте карточку
            товара в режиме read-only. Данные формируются из моков API с трассировкой запросов.
          </p>
        </div>
        <Button iconLeft="plus" disabled title="Создание товара появится на следующей итерации">
          Новый товар
        </Button>
      </header>

      <section
        style={{
          marginTop: '24px',
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--color-surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            alignItems: 'end',
          }}
        >
          <Input
            label="Поиск"
            placeholder="Название или артикул"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <Select
            label="Статус"
            value={status ?? ''}
            onChange={(event) => setStatus(event.target.value as ProductListQuery['status'])}
          >
            <option value="">Все статусы</option>
            {filters?.statuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Select
            label="Категория"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Все категории</option>
            {filters?.categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            label="Наличие"
            value={availability ?? ''}
            onChange={(event) =>
              setAvailability(event.target.value as ProductListQuery['availability_status'])
            }
          >
            <option value="">Любое</option>
            {filters?.availability_statuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Select label="Сортировка" value={sort} onChange={(event) => setSort(event.target.value)}>
            {filters?.sort.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button type="submit" variant="ghost" iconLeft="filter">
              Применить
            </Button>
            <Button type="button" variant="ghost" onClick={handleReset}>
              Сбросить
            </Button>
          </div>
        </form>
      </section>

      {isError ? (
        <div style={{ marginTop: '16px' }}>
          <Alert tone="danger" title="Ошибка загрузки">
            Не удалось загрузить список товаров.{' '}
            {error instanceof Error ? error.message : 'Повторите попытку позже.'}
          </Alert>
        </div>
      ) : null}

      <section style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {isLoading && !data ? (
          <Spinner label="Загружаем товары" />
        ) : (
          <Table
            columns={columns}
            data={rows}
            emptyMessage="По заданным условиям ничего не найдено. Попробуйте изменить фильтры."
          />
        )}

        {pagination ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <span style={{ color: 'var(--color-text-muted)' }}>
              {pagination.total_items > 0
                ? `Найдено ${pagination.total_items} товар(ов), страница ${pagination.page} из ${Math.max(
                    pagination.total_pages,
                    1
                  )}`
                : 'Нет товаров по текущему запросу'}
              {isFetching ? ' · Обновляем…' : ''}
            </span>
            <Pagination
              page={pagination.page}
              pages={Math.max(pagination.total_pages, 1)}
              onChange={(nextPage) => {
                setPage(nextPage);
              }}
            />
          </div>
        ) : null}

        {data?.trace_id ? <Tag>Trace ID: {data.trace_id}</Tag> : null}
      </section>
    </RoleGuard>
  );
}

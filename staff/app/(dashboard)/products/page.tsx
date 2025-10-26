'use client';

import { useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import {
  ProductCategoriesResponseItem,
  ProductListItem,
  ProductListQuery,
  EnumOption,
  productsApi,
  useInfiniteProductsQuery,
} from '@/entities/product';
import { RoleGuard, usePermission } from '@/features/auth';
import { Alert, Badge, Button, Input, Select, Spinner } from '@/shared/ui';

const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

const orderingOptions: { value: NonNullable<ProductListQuery['ordering']>; label: string }[] = [
  { value: '-created_at', label: 'Сначала новые' },
  { value: 'created_at', label: 'Сначала старые' },
  { value: 'price_rub', label: 'Цена по возрастанию' },
  { value: '-price_rub', label: 'Цена по убыванию' },
  { value: 'name', label: 'По алфавиту' },
  { value: '-name', label: 'По алфавиту (обратно)' },
];

const selfPickupOptions = [
  { value: '', label: 'Самовывоз: все' },
  { value: 'true', label: 'Только с самовывозом' },
  { value: 'false', label: 'Только доставка' },
];

const formatPrice = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const amount = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(amount)) {
    return '—';
  }
  return currencyFormatter.format(amount);
};

const flattenCategories = (
  nodes: ProductCategoriesResponseItem[],
  depth = 0
): { value: string; label: string }[] => {
  return nodes.flatMap((node) => [
    { value: node.id, label: `${' '.repeat(depth * 2)}${node.name}` },
    ...(node.children ? flattenCategories(node.children, depth + 1) : []),
  ]);
};

const buildCategoryNameMap = (
  nodes: ProductCategoriesResponseItem[],
  acc: Record<string, string> = {}
): Record<string, string> => {
  nodes.forEach((node) => {
    acc[node.id] = node.name;
    if (node.children?.length) {
      buildCategoryNameMap(node.children, acc);
    }
  });
  return acc;
};

const createEnumMap = (options?: EnumOption[]) =>
  options?.reduce<Record<string, string>>((acc, option) => {
    acc[option.value] = option.label;
    return acc;
  }, {}) ?? {};

const ProductCard = ({
  product,
  categoryName,
  colorLabel,
  transportLabel,
}: {
  product: ProductListItem;
  categoryName: string | undefined;
  colorLabel: string | undefined;
  transportLabel: string | undefined;
}) => {
  return (
    <article
      style={{
        display: 'flex',
        gap: '16px',
        padding: '20px',
        borderRadius: '16px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
      }}
    >
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'var(--color-surface-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {product.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumbnail_url}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Нет фото</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h2 style={{ fontSize: '1.125rem', margin: 0 }}>{product.name}</h2>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            {categoryName ?? 'Без категории'}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <Badge tone="success">{formatPrice(product.price_rub)}</Badge>
          {colorLabel ? <Badge tone="info">Цвет: {colorLabel}</Badge> : null}
          {transportLabel ? <Badge tone="info">Транспорт: {transportLabel}</Badge> : null}
          <Badge tone={product.delivery.self_pickup_allowed ? 'success' : 'info'}>
            {product.delivery.self_pickup_allowed ? 'Самовывоз доступен' : 'Только доставка'}
          </Badge>
        </div>
      </div>
    </article>
  );
};

export default function ProductsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedColor, setSelectedColor] = useState<ProductListQuery['color'] | ''>('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selfPickup, setSelfPickup] = useState('');
  const [ordering, setOrdering] = useState<ProductListQuery['ordering']>('-created_at');

  const canManageProducts = usePermission('products_add_product');

  const baseParams = useMemo<ProductListQuery>(
    () => ({
      limit: 20,
      q: searchTerm || undefined,
      color: (selectedColor || undefined) as ProductListQuery['color'] | undefined,
      category_id: selectedCategory || undefined,
      self_pickup: selfPickup === '' ? undefined : selfPickup === 'true',
      ordering,
    }),
    [ordering, searchTerm, selectedCategory, selectedColor, selfPickup]
  );

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useInfiniteProductsQuery(baseParams);

  const { data: enumsData } = useQuery({
    queryKey: ['products', 'enums'],
    queryFn: productsApi.enums,
    staleTime: 5 * 60 * 1000,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['products', 'categories'],
    queryFn: productsApi.categories,
    staleTime: 5 * 60 * 1000,
  });

  const categoryOptions = useMemo(
    () => (categoriesData ? flattenCategories(categoriesData) : []),
    [categoriesData]
  );
  const categoryNameMap = useMemo(
    () => (categoriesData ? buildCategoryNameMap(categoriesData) : {}),
    [categoriesData]
  );
  const colorOptions = enumsData?.colors ?? [];
  const colorLabelMap = useMemo(() => createEnumMap(enumsData?.colors), [enumsData]);
  const transportLabelMap = useMemo(
    () => createEnumMap(enumsData?.transport_restrictions),
    [enumsData]
  );

  const products = useMemo(() => data?.pages.flatMap((page) => page.results) ?? [], [data]);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) {
        fetchNextPage();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  };

  const handleReset = () => {
    setSearchInput('');
    setSearchTerm('');
    setSelectedColor('');
    setSelectedCategory('');
    setSelfPickup('');
    setOrdering('-created_at');
  };

  return (
    <RoleGuard allow={['adminpanel_view_products', 'inventory_view_inventoryitem']}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
              Реальный прайс-лист с поддержкой поиска, фильтрации и бесконечной прокрутки. Выбирайте
              товары по категории, цвету и доступности самовывоза.
            </p>
          </div>
          {canManageProducts ? (
            <Button iconLeft="plus">Новый товар</Button>
          ) : null}
        </header>

        <section
          style={{
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
              placeholder="Название товара"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Select
              label="Категория"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              <option value="">Все категории</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              label="Цвет"
              value={selectedColor ?? ''}
              onChange={(event) =>
                setSelectedColor(event.target.value as ProductListQuery['color'] | '')
              }
            >
              <option value="">Все цвета</option>
              {colorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              label="Самовывоз"
              value={selfPickup}
              onChange={(event) => setSelfPickup(event.target.value)}
            >
              {selfPickupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              label="Сортировка"
              value={ordering ?? '-created_at'}
              onChange={(event) => setOrdering(event.target.value as ProductListQuery['ordering'])}
            >
              {orderingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button type="submit" variant="primary">
                Применить
              </Button>
              <Button type="button" variant="ghost" onClick={handleReset}>
                Сбросить
              </Button>
            </div>
          </form>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isLoading ? <Spinner label="Загружаем товары" /> : null}

          {isError ? (
            <Alert tone="danger" title="Не удалось загрузить товары">
              {error instanceof Error
                ? error.message
                : 'Попробуйте обновить страницу немного позже.'}
            </Alert>
          ) : null}

          {!isLoading && !isError && products.length === 0 ? (
            <Alert tone="info" title="Товары не найдены">
              Попробуйте скорректировать параметры поиска.
            </Alert>
          ) : null}

          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categoryName={categoryNameMap[product.category_id ?? '']}
              colorLabel={product.color ? colorLabelMap[product.color] : undefined}
              transportLabel={
                product.delivery.transport_restriction
                  ? transportLabelMap[product.delivery.transport_restriction]
                  : undefined
              }
            />
          ))}

          <div ref={loadMoreRef} />

          {isFetchingNextPage ? <Spinner label="Загружаем ещё" /> : null}

          {hasNextPage && !isFetchingNextPage ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              Загрузить ещё
            </Button>
          ) : null}

          {isFetching && !isLoading && !isFetchingNextPage ? <Spinner /> : null}
        </section>
      </div>
    </RoleGuard>
  );
}

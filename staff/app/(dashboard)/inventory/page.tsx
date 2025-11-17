'use client';

import { useMemo } from 'react';

import { useInfiniteProductsQuery } from '@/entities/product';
import { RoleGuard } from '@/features/auth';
import { Alert, Badge, Button, Spinner, Table } from '@/shared/ui';

type InventoryRow = {
  id: string;
  name: string;
  totalQty: number;
  reservedQty: number;
  availableQty: number;
};

const PAGE_SIZE = 50;
const numberFormatter = new Intl.NumberFormat('ru-RU');
const formatQuantity = (value: number) => numberFormatter.format(value);

const SummaryCard = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      flex: '1 1 180px',
      minWidth: 180,
      padding: '16px',
      borderRadius: '12px',
      border: '1px solid var(--color-border)',
      background: 'var(--color-surface)',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}
  >
    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{label}</span>
    <strong style={{ fontSize: '1.5rem', lineHeight: 1 }}>{value}</strong>
  </div>
);

export default function InventoryPage() {
  const {
    data,
    error,
    isError,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteProductsQuery({ limit: PAGE_SIZE, ordering: 'name' });

  const inventoryRows = useMemo<InventoryRow[]>(() => {
    if (!data?.pages.length) {
      return [];
    }

    return data.pages.flatMap((page) =>
      page.results.map((product) => {
        const totalQty = Math.max(product.stock_qty ?? 0, 0);
        const availableQty = Math.max(product.available_stock_qty ?? 0, 0);
        return {
          id: product.id,
          name: product.name,
          totalQty,
          availableQty,
          reservedQty: Math.max(totalQty - availableQty, 0),
        } satisfies InventoryRow;
      })
    );
  }, [data]);

  const summaryTotals = useMemo(() => {
    return inventoryRows.reduce(
      (acc, row) => {
        acc.totalStock += row.totalQty;
        acc.available += row.availableQty;
        acc.reserved += row.reservedQty;
        return acc;
      },
      { totalStock: 0, available: 0, reserved: 0 }
    );
  }, [inventoryRows]);

  const isInitialLoading = isLoading && inventoryRows.length === 0;
  const hasErrorWithoutData = isError && inventoryRows.length === 0;

  return (
    <RoleGuard allow={['adminpanel_view_inventory', 'inventory_view_inventoryitem']}>
      <h1>Склад</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '16px' }}>
        В таблице отображаются фактические остатки товаров из каталога. Склад один, поэтому локацию
        не указываем.
      </p>

      {hasErrorWithoutData ? (
        <Alert tone="danger" title="Не удалось загрузить остатки">
          <p style={{ marginTop: 8 }}>
            {error instanceof Error ? error.message : 'Ошибка сервера'}
          </p>
          <Button onClick={() => refetch()} style={{ marginTop: 12 }}>
            Попробовать снова
          </Button>
        </Alert>
      ) : null}

      {isInitialLoading ? (
        <Spinner label="Загружаем товары" />
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <SummaryCard label="Позиции" value={formatQuantity(inventoryRows.length)} />
            <SummaryCard label="Всего единиц" value={formatQuantity(summaryTotals.totalStock)} />
            <SummaryCard label="Доступно" value={formatQuantity(summaryTotals.available)} />
            <SummaryCard label="В резерве" value={formatQuantity(summaryTotals.reserved)} />
          </div>

          <Table
            columns={[
              { key: 'id', header: 'Артикул' },
              { key: 'name', header: 'Позиция' },
              {
                key: 'reservedQty',
                header: 'В резерве',
                render: (row: InventoryRow) => (
                  <Badge tone={row.reservedQty > 0 ? 'warning' : 'success'}>
                    {formatQuantity(row.reservedQty)}
                  </Badge>
                ),
              },
              {
                key: 'availableQty',
                header: 'Доступно',
                render: (row: InventoryRow) => (
                  <Badge tone="success">{formatQuantity(row.availableQty)}</Badge>
                ),
              },
              {
                key: 'totalQty',
                header: 'Всего',
                render: (row: InventoryRow) => formatQuantity(row.totalQty),
              },
            ]}
            data={inventoryRows}
            emptyMessage="Нет товаров в каталоге."
          />

          {isError && !hasErrorWithoutData ? (
            <div style={{ marginTop: 16 }}>
              <Alert tone="danger" title="Есть проблемы с обновлением данных">
                Попробуйте обновить страницу — мы покажем новые остатки, когда API станет доступно.
              </Alert>
            </div>
          ) : null}

          {hasNextPage ? (
            <div style={{ marginTop: '16px' }}>
              <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? 'Загружаем...' : 'Загрузить ещё'}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </RoleGuard>
  );
}

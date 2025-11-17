'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import type { OrderListQuery, OrderStatus, OrderSummary } from '@/entities/order';
import { useOrdersQuery } from '@/entities/order';
import { useAuth } from '@/features/auth';
import { formatDateDisplay } from '@/shared/lib/date';
import type { TableColumn } from '@/shared/ui';
import { Alert, Badge, Spinner, Table, Tag } from '@/shared/ui';

const STATUS_BADGE_TONES: Record<OrderStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  new: 'info',
  reserved: 'warning',
  rented: 'success',
  in_work: 'info',
  archived: 'info',
  declined: 'danger',
};

const formatDisplayDate = (value: string | null | undefined) => formatDateDisplay(value) ?? '—';
const formatCount = (value?: number) =>
  typeof value === 'number' ? value.toLocaleString('ru-RU') : '—';

const buildTodayIso = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const todayIso = useMemo(buildTodayIso, []);

  const recentOrdersQuery = useMemo<OrderListQuery>(
    () => ({
      status_group: 'current',
      page_size: 5,
    }),
    []
  );

  const preparingOrdersQuery = useMemo<OrderListQuery>(
    () => ({
      status_group: 'current',
      logistics_state: ['handover_to_picking', 'picked'],
      page_size: 1,
    }),
    []
  );

  const overdueOrdersQuery = useMemo<OrderListQuery>(
    () => ({
      status_group: 'current',
      logistics_state: ['null'],
      installation_date_to: todayIso,
      page_size: 1,
    }),
    [todayIso]
  );

  const {
    data: recentOrdersResponse,
    isLoading: isRecentLoading,
    isError: isRecentError,
    error: recentError,
  } = useOrdersQuery(recentOrdersQuery);
  const { data: preparingOrdersResponse } = useOrdersQuery(preparingOrdersQuery);
  const { data: overdueOrdersResponse } = useOrdersQuery(overdueOrdersQuery);

  const recentOrders = recentOrdersResponse?.data ?? [];
  const activeOrdersCount = recentOrdersResponse?.meta?.pagination.total_items;
  const preparingOrdersCount = preparingOrdersResponse?.meta?.pagination.total_items;
  const overdueTasksCount = overdueOrdersResponse?.meta?.pagination.total_items;

  const stats = [
    {
      title: 'Активных заказов',
      value: formatCount(activeOrdersCount),
      description: 'Все заказы в статусе «Текущие»',
    },
    {
      title: 'Готовится к выдаче',
      value: formatCount(preparingOrdersCount),
      description: 'Передано на сборку или уже собрано',
    },
    {
      title: 'Просроченных задач',
      value: formatCount(overdueTasksCount),
      description: 'Монтаж сегодня и раньше без статуса логистики',
    },
  ];

  const columns = useMemo<TableColumn<OrderSummary>[]>(
    () => [
      {
        key: 'id',
        header: 'Заказ',
        render: (row) => (
          <Link href={`/orders/${row.id}`} style={{ fontWeight: 600 }}>
            #{row.id}
          </Link>
        ),
      },
      {
        key: 'customer',
        header: 'Клиент',
        render: (row) => row.customer?.display_name ?? '—',
      },
      {
        key: 'status',
        header: 'Статус',
        render: (row) => <Badge tone={STATUS_BADGE_TONES[row.status]}>{row.status_label}</Badge>,
      },
      {
        key: 'total_amount',
        header: 'Сумма',
        render: (row) => row.total_amount ?? '—',
      },
      {
        key: 'shipment_date',
        header: 'Отгрузка',
        render: (row) => formatDisplayDate(row.shipment_date),
      },
    ],
    []
  );

  return (
    <>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '24px',
        }}
      >
        {stats.map((item) => (
          <article
            key={item.title}
            style={{
              background: 'var(--color-surface)',
              borderRadius: '20px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
            }}
          >
            <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>{item.title}</span>
            <strong style={{ fontSize: '32px' }}>{item.value}</strong>
            <Tag tone="info">{item.description}</Tag>
          </article>
        ))}
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        <div>
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <h3 style={{ margin: 0 }}>Последние заказы</h3>
            <Link href="/orders" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
              Все заказы →
            </Link>
          </header>
          {isRecentLoading ? <Spinner size="sm" /> : null}
          {isRecentError ? (
            <Alert title="Не удалось загрузить данные">
              {recentError instanceof Error ? recentError.message : 'Попробуйте обновить страницу.'}
            </Alert>
          ) : null}
          {!isRecentLoading && !isRecentError ? (
            <Table
              columns={columns}
              data={recentOrders}
              emptyMessage="Нет заказов для отображения."
            />
          ) : null}
        </div>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3>Моя роль</h3>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Вы вошли как <strong>{user?.full_name}</strong>. Текущая роль —{' '}
            <strong>{user?.role}</strong>. Используйте страницу «Профиль» для просмотра матрицы
            доступов.
          </p>
        </aside>
      </section>
    </>
  );
}

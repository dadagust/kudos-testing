'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { OrderDetail, OrderStatus, ORDER_STATUS_LABELS, useOrderQuery } from '@/entities/order';
import { RoleGuard } from '@/features/auth';
import { Alert, Badge, Button, Spinner, Table, Tag } from '@/shared/ui';
import type { TableColumn } from '@/shared/ui';

const formatDate = (value: string) => new Date(value).toLocaleDateString('ru-RU');

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });

const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 2,
});

const formatCurrency = (value: string) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return value;
  }
  return currencyFormatter.format(amount);
};

const STATUS_TONE: Record<OrderStatus, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  new: 'info',
  reserved: 'warning',
  rented: 'success',
  in_work: 'info',
  archived: 'default',
  declined: 'danger',
};

interface OrderDetailsPageProps {
  params: { orderId: string };
}

const itemColumns: TableColumn<OrderDetail['items'][number]>[] = [
  { key: 'product_label', header: 'Товар' },
  { key: 'quantity', header: 'Количество' },
  {
    key: 'unit_price',
    header: 'Цена за единицу',
    render: (item) => formatCurrency(item.unit_price),
  },
  {
    key: 'subtotal',
    header: 'Сумма',
    render: (item) => formatCurrency(item.subtotal),
  },
];

export default function OrderDetailsPage({ params }: OrderDetailsPageProps) {
  const router = useRouter();
  const { data, isLoading, isError, error } = useOrderQuery(params.orderId);
  const order = data?.data;

  return (
    <RoleGuard allow={[{ scope: 'admin_orders' }, { scope: 'orders' }]}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button variant="ghost" onClick={() => router.back()}>
            ← Назад к списку
          </Button>
          {order ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <Tag tone={STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Tag>
              <Badge tone={order.delivery_type === 'pickup' ? 'info' : 'success'}>
                {order.delivery_type === 'pickup' ? 'Самовывоз' : 'Доставка'}
              </Badge>
            </div>
          ) : null}
        </div>

        {isLoading ? <Spinner label="Загружаем данные заказа" /> : null}

        {isError ? (
          <Alert tone="danger" title="Не удалось загрузить заказ">
            {error instanceof Error ? error.message : 'Попробуйте обновить страницу чуть позже.'}
          </Alert>
        ) : null}

        {!isLoading && !isError && !order ? (
          <Alert tone="info" title="Заказ не найден">
            Проверьте корректность ссылки или вернитесь к списку заказов.
          </Alert>
        ) : null}

        {order ? (
          <article
            style={{
              background: 'var(--color-surface)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '32px',
            }}
          >
            <header style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Заказ №{order.id}</h1>
              {order.comment ? (
                <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{order.comment}</p>
              ) : null}
            </header>

            <section
              style={{
                display: 'grid',
                gap: '24px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Основная информация</h2>
                <dl style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Статус</dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Дата монтажа</dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>{formatDate(order.installation_date)}</dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Дата демонтажа</dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>{formatDate(order.dismantle_date)}</dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Создан</dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>{formatDateTime(order.created)}</dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Обновлён</dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>{formatDateTime(order.modified)}</dd>
                  </div>
                </dl>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Доставка</h2>
                <dl style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Способ</dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                      {order.delivery_type === 'pickup' ? 'Самовывоз' : 'Доставка'}
                    </dd>
                  </div>
                  {order.delivery_type === 'delivery' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Адрес</dt>
                      <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                        {order.delivery_address || 'Адрес не указан'}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Клиент</h2>
                {order.customer ? (
                  <dl style={{ display: 'grid', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Имя</dt>
                      <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>{order.customer.display_name}</dd>
                    </div>
                    <Link href={`/customers/${order.customer.id}`} style={{ color: 'var(--color-primary)' }}>
                      Перейти в карточку клиента →
                    </Link>
                  </dl>
                ) : (
                  <span style={{ color: 'var(--color-text-muted)' }}>Клиент не указан.</span>
                )}
              </div>
            </section>

            <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Позиции заказа</h2>
              <Table<OrderDetail['items'][number]>
                columns={itemColumns}
                data={order.items}
                emptyMessage="К заказу не привязаны товары."
              />
            </section>

            <footer
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Сумма заказа</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 600 }}>{formatCurrency(order.total_amount)}</div>
              </div>
              {order.comment ? null : <span />}
            </footer>
          </article>
        ) : null}
      </div>
    </RoleGuard>
  );
}

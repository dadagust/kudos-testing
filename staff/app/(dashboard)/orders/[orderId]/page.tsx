'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useState } from 'react';

import {
  OrderDetail,
  OrderStatus,
  ORDER_STATUS_LABELS,
  useOrderQuery,
  useUpdateOrderServiceTotalsMutation,
} from '@/entities/order';
import { RoleGuard, usePermission } from '@/features/auth';
import { ensureDateDisplay, ensureDateTimeDisplay, ensureTimeDisplay } from '@/shared/lib/date';
import { Alert, Badge, Button, Input, Modal, Spinner, Table, Tag } from '@/shared/ui';
import type { TableColumn } from '@/shared/ui';

const formatDate = (value: string) => ensureDateDisplay(value);

const formatDateTime = (value: string) => ensureDateTimeDisplay(value);

const formatTime = (value: string | null | undefined) => ensureTimeDisplay(value);

const formatTimeRange = (
  start: string | null | undefined,
  end: string | null | undefined
): string | null => {
  const startFormatted = formatTime(start);
  const endFormatted = formatTime(end);
  if (startFormatted !== '—' && endFormatted !== '—') {
    return `${startFormatted}–${endFormatted}`;
  }
  if (startFormatted !== '—') {
    return `${startFormatted}–`;
  }
  if (endFormatted !== '—') {
    return `–${endFormatted}`;
  }
  return null;
};

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

const ITEM_THUMBNAIL_SIZE = 80;

const renderItemThumbnail = (item: OrderDetail['items'][number]) => {
  const name = item.product?.name ?? item.product_name ?? 'Фото товара';

  if (item.product?.thumbnail_url) {
    return (
      <Image
        src={item.product.thumbnail_url}
        alt={name}
        width={ITEM_THUMBNAIL_SIZE}
        height={ITEM_THUMBNAIL_SIZE}
        style={{
          width: `${ITEM_THUMBNAIL_SIZE}px`,
          height: `${ITEM_THUMBNAIL_SIZE}px`,
          borderRadius: '12px',
          objectFit: 'cover',
        }}
        unoptimized
      />
    );
  }

  return (
    <div
      style={{
        width: `${ITEM_THUMBNAIL_SIZE}px`,
        height: `${ITEM_THUMBNAIL_SIZE}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '12px',
        background: 'var(--color-surface-muted)',
        color: 'var(--color-text-muted)',
        fontSize: '0.75rem',
        fontWeight: 500,
      }}
    >
      Нет фото
    </div>
  );
};

const itemColumns: TableColumn<OrderDetail['items'][number]>[] = [
  {
    key: 'thumbnail',
    header: 'Фото',
    render: renderItemThumbnail,
  },
  {
    key: 'product',
    header: 'Товар',
    render: (item) => item.product?.name ?? item.product_name ?? '—',
  },
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

type ServiceTotalsFormState = {
  delivery_total_amount: string;
  installation_total_amount: string;
  dismantle_total_amount: string;
};

export default function OrderDetailsPage({ params }: OrderDetailsPageProps) {
  const router = useRouter();
  const { data, isLoading, isError, error } = useOrderQuery(params.orderId);
  const order = data?.data;
  const customerPhone = order?.customer?.phone?.trim() ?? '';
  const canManageOrders = usePermission('orders_change_order');
  const [isServiceTotalsModalOpen, setIsServiceTotalsModalOpen] = useState(false);
  const [serviceTotalsForm, setServiceTotalsForm] = useState<ServiceTotalsFormState>({
    delivery_total_amount: '',
    installation_total_amount: '',
    dismantle_total_amount: '',
  });
  const [serviceTotalsError, setServiceTotalsError] = useState<string | null>(null);
  const updateServiceTotalsMutation = useUpdateOrderServiceTotalsMutation();
  const isSavingServiceTotals = updateServiceTotalsMutation.isPending;

  const handleOpenServiceTotalsModal = () => {
    if (!order) {
      return;
    }
    setServiceTotalsForm({
      delivery_total_amount: order.delivery_total_amount ?? '',
      installation_total_amount: order.installation_total_amount ?? '',
      dismantle_total_amount: order.dismantle_total_amount ?? '',
    });
    setServiceTotalsError(null);
    setIsServiceTotalsModalOpen(true);
  };

  const handleCloseServiceTotalsModal = () => {
    if (isSavingServiceTotals) {
      return;
    }
    setIsServiceTotalsModalOpen(false);
  };

  const handleServiceTotalsChange =
    (field: keyof ServiceTotalsFormState) => (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setServiceTotalsForm((prev) => ({ ...prev, [field]: value }));
    };

  const normalizeAmountInput = (value: string) => {
    const normalized = value.replace(',', '.').trim();
    return normalized || '0';
  };

  const handleServiceTotalsSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!order) {
      return;
    }
    setServiceTotalsError(null);
    const payload = {
      delivery_total_amount: normalizeAmountInput(serviceTotalsForm.delivery_total_amount),
      installation_total_amount: normalizeAmountInput(serviceTotalsForm.installation_total_amount),
      dismantle_total_amount: normalizeAmountInput(serviceTotalsForm.dismantle_total_amount),
    };
    updateServiceTotalsMutation.mutate(
      { orderId: order.id, payload },
      {
        onSuccess: () => {
          setIsServiceTotalsModalOpen(false);
        },
        onError: () => {
          setServiceTotalsError('Не удалось сохранить изменения. Попробуйте ещё раз.');
        },
      }
    );
  };

  return (
    <RoleGuard allow={['adminpanel_view_orders', 'orders_view_order']}>
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
              {canManageOrders ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push(`/orders?edit=${order.id}`)}
                >
                  Редактировать
                </Button>
              ) : null}
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
              {order.comment_for_waybill ? (
                <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                  <strong>Комментарий для накладной:</strong> {order.comment_for_waybill}
                </p>
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
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Статус
                    </dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Дата монтажа
                    </dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                      {formatDate(order.installation_date)}
                    </dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Время монтажа
                    </dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                      {formatTimeRange(order.mount_datetime_from, order.mount_datetime_to) ?? '—'}
                    </dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Дата демонтажа
                    </dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                      {formatDate(order.dismantle_date)}
                    </dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Время демонтажа
                    </dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                      {formatTimeRange(order.dismount_datetime_from, order.dismount_datetime_to) ??
                        '—'}
                    </dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Создан
                    </dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                      {formatDateTime(order.created)}
                    </dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Обновлён
                    </dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                      {formatDateTime(order.modified)}
                    </dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Комментарий для накладной
                    </dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                      {order.comment_for_waybill || '—'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Доставка</h2>
                  {canManageOrders ? (
                    <Button type="button" variant="ghost" onClick={handleOpenServiceTotalsModal}>
                      Изменить стоимости
                    </Button>
                  ) : null}
                </div>
                <dl style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Способ
                    </dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                      {order.delivery_type === 'pickup' ? 'Самовывоз' : 'Доставка'}
                    </dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Стоимость доставки
                    </dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                      {formatCurrency(order.delivery_total_amount)}
                    </dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Стоимость монтажа
                    </dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                      {formatCurrency(order.installation_total_amount)}
                    </dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Стоимость демонтажа
                    </dt>
                    <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                      {formatCurrency(order.dismantle_total_amount)}
                    </dd>
                  </div>
                  {order.delivery_type === 'delivery' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        Адрес
                      </dt>
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
                      <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        Имя
                      </dt>
                      <dd
                        style={{
                          fontWeight: 600,
                          marginInlineStart: 0,
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>{order.customer.display_name}</span>
                        {customerPhone ? (
                          <a
                            href={`tel:${customerPhone.replace(/[^+\d]/g, '')}`}
                            style={{ color: 'var(--color-primary)', fontWeight: 500 }}
                          >
                            {customerPhone}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
                            —
                          </span>
                        )}
                      </dd>
                    </div>
                    <Link
                      href={`/customers/${order.customer.id}`}
                      style={{ color: 'var(--color-primary)' }}
                    >
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
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  Сумма заказа
                </span>
                <div style={{ fontSize: '1.75rem', fontWeight: 600 }}>
                  {formatCurrency(order.total_amount)}
                </div>
              </div>
              {order.comment || order.comment_for_waybill ? null : <span />}
            </footer>
          </article>
        ) : null}
      </div>
      <Modal
        open={isServiceTotalsModalOpen}
        onClose={handleCloseServiceTotalsModal}
        title="Редактирование стоимости услуг"
      >
        <form
          onSubmit={handleServiceTotalsSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}
        >
          <Input
            label="Стоимость доставки, ₽"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={serviceTotalsForm.delivery_total_amount}
            onChange={handleServiceTotalsChange('delivery_total_amount')}
            required
            disabled={isSavingServiceTotals}
          />
          <Input
            label="Стоимость монтажа, ₽"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={serviceTotalsForm.installation_total_amount}
            onChange={handleServiceTotalsChange('installation_total_amount')}
            required
            disabled={isSavingServiceTotals}
          />
          <Input
            label="Стоимость демонтажа, ₽"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={serviceTotalsForm.dismantle_total_amount}
            onChange={handleServiceTotalsChange('dismantle_total_amount')}
            required
            disabled={isSavingServiceTotals}
          />
          {serviceTotalsError ? (
            <Alert tone="danger" title="Ошибка">
              {serviceTotalsError}
            </Alert>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={handleCloseServiceTotalsModal}
              disabled={isSavingServiceTotals}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={isSavingServiceTotals}>
              Сохранить
            </Button>
          </div>
        </form>
      </Modal>
    </RoleGuard>
  );
}

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  LOGISTICS_STATE_LABELS,
  LogisticsState,
  OrderSummary,
  PAYMENT_STATUS_LABELS,
  PaymentStatus,
  ordersApi,
  useOrdersQuery,
  useOrderWaybill,
} from '@/entities/order';
import { formatDateDisplay, formatTimeDisplay, toTimestamp } from '@/shared/lib/date';
import { Accordion, Button, FormField, Input, Spinner, Tag } from '@/shared/ui';

import { openWaybillPreviewWindow } from '../utils/openWaybillPreviewWindow';

import styles from './prep.module.sass';

const PAYMENT_TONES: Record<PaymentStatus, 'success' | 'danger' | 'warning'> = {
  paid: 'success',
  unpaid: 'danger',
  partially_paid: 'warning',
};

const LOGISTICS_STATES: LogisticsState[] = ['handover_to_picking', 'picked', 'shipped'];

const formatTimeRange = (
  start: string | null | undefined,
  end: string | null | undefined
): string | null => {
  const formattedStart = formatTimeDisplay(start) ?? '';
  const formattedEnd = formatTimeDisplay(end) ?? '';

  if (formattedStart && formattedEnd) {
    return `${formattedStart}–${formattedEnd}`;
  }
  if (formattedStart) {
    return `${formattedStart}–`;
  }
  if (formattedEnd) {
    return `–${formattedEnd}`;
  }
  return null;
};

interface LogisticsStateToggleProps {
  order: OrderSummary;
  isUpdating: boolean;
  onChange: (state: LogisticsState | null) => void;
}

const LogisticsStateToggle = ({ order, isUpdating, onChange }: LogisticsStateToggleProps) => (
  <div className={styles.stateToggle}>
    {LOGISTICS_STATES.map((state) => {
      const isActive = order.logistics_state === state;
      return (
        <Button
          key={state}
          variant={isActive ? 'primary' : 'ghost'}
          className={styles.stateButton}
          disabled={isUpdating}
          onClick={() => onChange(isActive ? null : state)}
        >
          {LOGISTICS_STATE_LABELS[state]}
        </Button>
      );
    })}
  </div>
);

const formatInstallationGroup = (value: string | null) => {
  if (!value) {
    return 'Без даты';
  }
  const formatted = formatDateDisplay(value);
  const timestamp = toTimestamp(value);
  if (!timestamp) {
    return formatted ?? value;
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const diff = Math.floor((timestamp - startOfToday.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) {
    return 'Сегодня';
  }
  if (diff === 1) {
    return 'Завтра';
  }
  return formatted ?? new Date(timestamp).toLocaleDateString('ru-RU');
};

export default function LogisticsPrepPage() {
  const [paymentFilters, setPaymentFilters] = useState<PaymentStatus[]>([]);
  const [logisticsFilters, setLogisticsFilters] = useState<Array<LogisticsState | 'null'>>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const handleResetSearch = () => {
    setSearchInput('');
    setSearchTerm('');
  };

  useEffect(() => {
    const normalizedInput = searchInput.trim();

    if (normalizedInput === searchTerm) {
      return;
    }

    setSearchTerm(normalizedInput);
  }, [searchInput, searchTerm]);

  const query = useMemo(
    () => ({
      payment_status: paymentFilters.length ? paymentFilters : undefined,
      logistics_state: logisticsFilters.length ? logisticsFilters : undefined,
      installation_date_from: dateFrom || undefined,
      installation_date_to: dateTo || undefined,
      search: searchTerm || undefined,
      q: searchTerm || undefined,
      status_group: 'current' as const,
    }),
    [paymentFilters, logisticsFilters, dateFrom, dateTo, searchTerm]
  );

  const { data, isLoading, isFetching, refetch } = useOrdersQuery(query);
  const orders = useMemo(() => data?.data ?? [], [data]);

  const queryClient = useQueryClient();

  const updateStateMutation = useMutation({
    mutationFn: ({ orderId, state }: { orderId: number; state: LogisticsState | null }) =>
      ordersApi.updateLogisticsState(orderId, state),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const waybillMutation = useOrderWaybill();

  const handleWaybillClick = (orderId: number) => {
    const targetWindow = openWaybillPreviewWindow(orderId);
    waybillMutation.mutate({ orderId, context: 'prep', targetWindow });
  };

  const groupedOrders = useMemo(
    () =>
      Array.from(
        orders.reduce((acc, order) => {
          const key = order.installation_date || 'null';
          const list = acc.get(key) ?? [];
          list.push(order);
          acc.set(key, list);
          return acc;
        }, new Map<string, OrderSummary[]>())
      )
        .sort((a, b) => {
          if (a[0] === 'null') {
            return 1;
          }
          if (b[0] === 'null') {
            return -1;
          }
          return b[0].localeCompare(a[0]);
        })
        .map(([date, items]) => ({
          key: date,
          label: formatInstallationGroup(date === 'null' ? null : date),
          items,
        })),
    [orders]
  );

  const paymentSelectedCount = paymentFilters.length;
  const logisticsSelectedCount = logisticsFilters.length;

  const togglePaymentFilter = (status: PaymentStatus) => {
    setPaymentFilters((prev) =>
      prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status]
    );
  };

  const toggleLogisticsFilter = (state: LogisticsState | 'null') => {
    setLogisticsFilters((prev) =>
      prev.includes(state) ? prev.filter((item) => item !== state) : [...prev, state]
    );
  };

  return (
    <section className={styles.wrapper}>
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>
            Статус оплаты
            {paymentSelectedCount ? <Tag tone="info">{paymentSelectedCount}</Tag> : null}
          </span>
          <div className={styles.chips}>
            {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((status) => {
              const isActive = paymentFilters.includes(status);
              return (
                <Button
                  key={status}
                  variant={isActive ? 'primary' : 'ghost'}
                  className={styles.chipButton}
                  onClick={() => togglePaymentFilter(status)}
                >
                  {PAYMENT_STATUS_LABELS[status]}
                </Button>
              );
            })}
          </div>
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>
            Состояние логистики
            {logisticsSelectedCount ? <Tag tone="info">{logisticsSelectedCount}</Tag> : null}
          </span>
          <div className={styles.chips}>
            <Button
              variant={logisticsFilters.includes('null') ? 'primary' : 'ghost'}
              className={styles.chipButton}
              onClick={() => toggleLogisticsFilter('null')}
            >
              Без состояния
            </Button>
            {LOGISTICS_STATES.map((state) => {
              const isActive = logisticsFilters.includes(state);
              return (
                <Button
                  key={state}
                  variant={isActive ? 'primary' : 'ghost'}
                  className={styles.chipButton}
                  onClick={() => toggleLogisticsFilter(state)}
                >
                  {LOGISTICS_STATE_LABELS[state]}
                </Button>
              );
            })}
          </div>
        </div>
        <div className={styles.dateRange}>
          <FormField label="Монтаж с">
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </FormField>
          <FormField label="По">
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </FormField>
        </div>
        <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Поиск по номеру, адресу или комментариям"
            className={styles.searchInput}
          />
          <Button type="submit">Найти</Button>
          <Button type="button" variant="ghost" onClick={handleResetSearch}>
            Сбросить
          </Button>
        </form>
      </div>

      {isLoading ? (
        <div className={styles.stateRow}>
          <Spinner />
        </div>
      ) : null}

      {!isLoading && groupedOrders.length === 0 ? (
        <div className={styles.stateRow}>Заказы не найдены.</div>
      ) : null}

      {groupedOrders.map((group) => (
        <div key={group.key} className={styles.group}>
          <Accordion
            title={group.label}
            defaultOpen
            actions={
              <div className={styles.groupActions}>
                <Tag tone="info">{group.items.length}</Tag>
                {isFetching ? <Spinner /> : null}
              </div>
            }
          >
            <div className={styles.list}>
              {group.items.map((order) => {
                const isUpdating = updateStateMutation.isPending;
                const isGeneratingWaybill =
                  waybillMutation.isPending && waybillMutation.variables?.orderId === order.id;
                const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
                const uniqueProducts = new Set(
                  order.items.map((item) => item.product?.id ?? `custom:${item.product_name}`)
                ).size;
                const address = order.delivery_address_full || order.delivery_address;
                const mountRange = formatTimeRange(
                  order.mount_datetime_from,
                  order.mount_datetime_to
                );
                return (
                  <article key={order.id} className={styles.card}>
                    <header className={styles.cardHeader}>
                      <div>
                        <Link href={`/orders/${order.id}`} className={styles.cardTitle}>
                          Заказ #{order.id}
                        </Link>
                        <div className={styles.cardMeta}>
                          <Tag tone={PAYMENT_TONES[order.payment_status]}>
                            {PAYMENT_STATUS_LABELS[order.payment_status]}
                          </Tag>
                          <span>
                            {order.delivery_type === 'delivery' ? 'Адресная доставка' : 'Самовывоз'}
                          </span>
                          {address ? <span>{address}</span> : null}
                          <span>Монтаж: {mountRange ?? '—'}</span>
                          {order.comment ? (
                            <span className={styles.comment}>{order.comment}</span>
                          ) : null}
                          {order.comment_for_waybill ? (
                            <span className={styles.comment}>
                              Накладная: {order.comment_for_waybill}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className={styles.cardActions}>
                        <Button
                          variant="ghost"
                          iconLeft="print"
                          onClick={() => handleWaybillClick(order.id)}
                          disabled={isGeneratingWaybill}
                        >
                          Накладная
                        </Button>
                        <LogisticsStateToggle
                          order={order}
                          isUpdating={isUpdating}
                          onChange={(state) =>
                            updateStateMutation.mutate(
                              { orderId: order.id, state },
                              {
                                onSuccess: () => {
                                  void refetch();
                                },
                              }
                            )
                          }
                        />
                      </div>
                    </header>
                    <div className={styles.itemsSummary}>
                      <span>Всего товаров: {totalQuantity} шт.</span>
                      <span>Наименований: {uniqueProducts}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </Accordion>
        </div>
      ))}
    </section>
  );
}

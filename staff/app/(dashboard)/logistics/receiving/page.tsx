'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import type { OrderListQuery, OrderSummary } from '@/entities/order';
import {
  LOGISTICS_STATE_LABELS,
  ordersApi,
  useOrderWaybill,
  useOrdersQuery,
} from '@/entities/order';
import { formatDateDisplay, formatTimeDisplay } from '@/shared/lib/date';
import { Accordion, Button, FormField, Input, Spinner, Tag } from '@/shared/ui';

import { openWaybillPreviewWindow } from '../utils/openWaybillPreviewWindow';

import styles from './receiving.module.sass';

const formatDismantleGroup = (value: string | null) => {
  if (!value) {
    return 'Без даты';
  }

  return formatDateDisplay(value) ?? value;
};

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

export default function LogisticsReceivingPage() {
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

  const query = useMemo<OrderListQuery>(
    () => ({
      logistics_state: ['shipped'],
      dismantle_date_from: dateFrom || undefined,
      dismantle_date_to: dateTo || undefined,
      search: searchTerm || undefined,
      q: searchTerm || undefined,
    }),
    [dateFrom, dateTo, searchTerm]
  );

  const { data, isLoading, isFetching } = useOrdersQuery(query);
  const queryClient = useQueryClient();

  const receiveMutation = useMutation({
    mutationFn: (orderId: number) => ordersApi.receive(orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const waybillMutation = useOrderWaybill();

  const handleWaybillClick = (orderId: number) => {
    const targetWindow = openWaybillPreviewWindow(orderId);
    waybillMutation.mutate({ orderId, context: 'receiving', targetWindow });
  };

  const orders = useMemo(
    () => (data?.data ?? []).filter((order) => !order.is_warehouse_received),
    [data]
  );

  const groupedOrders = useMemo(
    () =>
      Array.from(
        orders.reduce((acc, order) => {
          const key = order.dismantle_date || 'null';
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
          label: formatDismantleGroup(date === 'null' ? null : date),
          items,
        })),
    [orders]
  );

  return (
    <section className={styles.wrapper}>
      <div className={styles.filters}>
        <FormField label="Демонтаж с">
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </FormField>
        <FormField label="По">
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </FormField>
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
        <div className={styles.stateRow}>Нет заказов, ожидающих приёмку.</div>
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
                const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
                const uniqueProducts = new Set(
                  order.items.map((item) => item.product?.id ?? `custom:${item.product_name}`)
                ).size;
                const address = order.delivery_address_full || order.delivery_address;
                const dismountRange = formatTimeRange(
                  order.dismount_datetime_from,
                  order.dismount_datetime_to
                );
                return (
                  <article key={order.id} className={styles.card}>
                    <header className={styles.cardHeader}>
                      <div>
                        <Link href={`/orders/${order.id}`} className={styles.cardTitle}>
                          Заказ #{order.id}
                        </Link>
                        <div className={styles.cardMeta}>
                          <span>
                            {order.delivery_type === 'delivery' ? 'Адресная доставка' : 'Самовывоз'}
                          </span>
                          {address ? <span>{address}</span> : null}
                          <span>Демонтаж: {formatDismantleGroup(order.dismantle_date)}</span>
                          <span>Время демонтажа: {dismountRange ?? '—'}</span>
                          <span>{LOGISTICS_STATE_LABELS[order.logistics_state ?? 'shipped']}</span>
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
                          disabled={
                            waybillMutation.isPending &&
                            waybillMutation.variables?.orderId === order.id
                          }
                        >
                          Накладная
                        </Button>
                        <Button
                          variant="primary"
                          onClick={() => receiveMutation.mutate(order.id)}
                          disabled={receiveMutation.isPending}
                        >
                          Принят на склад
                        </Button>
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

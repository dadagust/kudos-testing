'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { OrderListQuery } from '@/entities/order';
import { LOGISTICS_STATE_LABELS, ordersApi, useOrdersQuery } from '@/entities/order';
import { formatDateDisplay } from '@/shared/lib/date';
import { Button, FormField, Input, Spinner } from '@/shared/ui';

import styles from './receiving.module.sass';

export default function LogisticsReceivingPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const query = useMemo<OrderListQuery>(
    () => ({
      logistics_state: ['shipped'],
      shipment_date_from: dateFrom || undefined,
      shipment_date_to: dateTo || undefined,
      q: search.trim() || undefined,
    }),
    [dateFrom, dateTo, search]
  );

  const { data, isLoading, isFetching } = useOrdersQuery(query);
  const queryClient = useQueryClient();

  const receiveMutation = useMutation({
    mutationFn: (orderId: number) => ordersApi.receive(orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const orders = useMemo(
    () => (data?.data ?? []).filter((order) => !order.is_warehouse_received),
    [data]
  );

  return (
    <section className={styles.wrapper}>
      <div className={styles.filters}>
        <FormField label="Отгрузка с">
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </FormField>
        <FormField label="По">
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </FormField>
        <FormField label="Поиск по номеру">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Например, 2048"
          />
        </FormField>
      </div>

      {isLoading ? (
        <div className={styles.stateRow}>
          <Spinner size="lg" />
        </div>
      ) : null}

      {!isLoading && orders.length === 0 ? (
        <div className={styles.stateRow}>Нет заказов, ожидающих приёмку.</div>
      ) : null}

      <div className={styles.list}>
        {orders.map((order) => (
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
                  {order.shipment_date ? (
                    <span>
                      Отгрузка: {formatDateDisplay(order.shipment_date) ?? order.shipment_date}
                    </span>
                  ) : null}
                  <span>{LOGISTICS_STATE_LABELS[order.logistics_state ?? 'shipped']}</span>
                  {order.comment ? <span className={styles.comment}>{order.comment}</span> : null}
                </div>
              </div>
              <Button
                variant="primary"
                onClick={() => receiveMutation.mutate(order.id)}
                disabled={receiveMutation.isPending}
              >
                Принят на склад
              </Button>
            </header>
            <ul className={styles.items}>
              {order.items.map((item) => (
                <li key={item.id} className={styles.itemRow}>
                  {item.product?.thumbnail_url ? (
                    <Image
                      src={item.product.thumbnail_url}
                      alt={item.product.name}
                      className={styles.itemImage}
                      width={48}
                      height={48}
                      unoptimized
                    />
                  ) : null}
                  <div>
                    <span className={styles.itemTitle}>
                      {item.product?.name ?? item.product_name}
                    </span>
                    <span className={styles.itemMeta}>{item.quantity} шт.</span>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      {isFetching && !isLoading ? (
        <div className={styles.stateRow}>
          <Spinner size="sm" />
        </div>
      ) : null}
    </section>
  );
}

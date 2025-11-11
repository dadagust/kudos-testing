'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import type { OrderListQuery } from '@/entities/order';
import {
  LOGISTICS_STATE_LABELS,
  ordersApi,
  useOrderWaybill,
  useOrdersQuery,
} from '@/entities/order';
import { formatDateDisplay } from '@/shared/lib/date';
import { Button, FormField, Input, Spinner } from '@/shared/ui';

import { openWaybillPreviewWindow } from '../utils/openWaybillPreviewWindow';

import styles from './receiving.module.sass';

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
      shipment_date_from: dateFrom || undefined,
      shipment_date_to: dateTo || undefined,
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
        <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Поиск по номеру, адресу или комментарию"
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
              <div className={styles.cardActions}>
                <Button
                  variant="ghost"
                  iconLeft="print"
                  onClick={() => handleWaybillClick(order.id)}
                  disabled={
                    waybillMutation.isPending && waybillMutation.variables?.orderId === order.id
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
            <ul className={styles.items}>
              {order.items.map((item) => (
                <li key={item.id} className={styles.itemRow}>
                  {item.product?.thumbnail_url ? (
                    <Image
                      src={item.product.thumbnail_url}
                      alt={item.product.name}
                      className={styles.itemImage}
                      width={120}
                      height={120}
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
          <Spinner />
        </div>
      ) : null}
    </section>
  );
}

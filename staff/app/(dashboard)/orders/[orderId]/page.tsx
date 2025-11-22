'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useMemo, useState } from 'react';

import {
  DeliveryPricingSummary,
  OrderDetail,
  OrderStatus,
  ORDER_STATUS_LABELS,
  useOrderQuery,
  useUpdateOrderServiceTotalsMutation,
} from '@/entities/order';
import { RoleGuard, usePermission } from '@/features/auth';
import { ensureDateDisplay, ensureDateTimeDisplay, ensureTimeDisplay } from '@/shared/lib/date';
import { Alert, Badge, Button, Input, Modal, Select, Spinner, Table, Tag } from '@/shared/ui';
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

const formatVolume = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) {
    return '—';
  }
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(numericValue)) {
    return '—';
  }
  const cubicMeters = numericValue / 1_000_000;
  const fractionDigits = cubicMeters >= 10 ? 1 : 2;
  return `${cubicMeters.toFixed(fractionDigits)} м³`;
};

const formatDistance = (value: string | null | undefined) => {
  if (!value) {
    return '—';
  }
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return value;
  }
  return `${numericValue.toFixed(2)} км`;
};

type DeliveryTransportOption = {
  transport_label: string;
  transport_value: string;
  transport_capacity_volume_cm3: number | null;
  required_volume_cm3: number | null;
  cost_per_transport: number | null;
};

type DeliveryTransportSelection = {
  transport_value: string;
  transport_count: string;
};

type DeliveryPricingForm = {
  distance_km: string;
  total_volume_cm3: string;
  transports: DeliveryTransportSelection[];
};

const buildDeliveryPricingForm = (
  pricing: DeliveryPricingSummary | null | undefined
): DeliveryPricingForm => ({
  distance_km: pricing?.distance_km ?? '',
  total_volume_cm3:
    pricing?.total_volume_cm3 !== undefined && pricing?.total_volume_cm3 !== null
      ? String(pricing.total_volume_cm3)
      : '',
  transports:
    pricing?.transports?.map((transport) => ({
      transport_value: transport.transport.value ?? '',
      transport_count:
        transport.transport_count !== undefined && transport.transport_count !== null
          ? String(transport.transport_count)
          : '',
    })) ?? [],
});

const parseInteger = (value: string) => {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const numericValue = Number(normalized);
  if (Number.isNaN(numericValue)) {
    return undefined;
  }
  return Math.trunc(numericValue);
};

const parseDecimal = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return undefined;
  }
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numericValue)) {
    return undefined;
  }
  return numericValue;
};

const formatDecimal = (value: number | undefined) =>
  value === undefined ? undefined : value.toFixed(2);

const buildAvailableTransports = (
  pricing: DeliveryPricingSummary | null | undefined
): DeliveryTransportOption[] => {
  const transports = pricing?.transports ?? [];
  const uniqueTransports = new Map<string, DeliveryTransportOption>();
  transports.forEach((transport) => {
    const value = transport.transport.value ?? '';
    if (!value || uniqueTransports.has(value)) {
      return;
    }
    uniqueTransports.set(value, {
      transport_label: transport.transport.label ?? value,
      transport_value: value,
      transport_capacity_volume_cm3: parseDecimal(transport.transport.capacity_volume_cm3) ?? null,
      required_volume_cm3: parseDecimal(transport.required_volume_cm3) ?? null,
      cost_per_transport: parseDecimal(transport.cost_per_transport) ?? null,
    });
  });
  return Array.from(uniqueTransports.values()).sort(
    (a, b) => (b.transport_capacity_volume_cm3 ?? 0) - (a.transport_capacity_volume_cm3 ?? 0)
  );
};

const evaluateDeliverySelection = (
  form: DeliveryPricingForm,
  options: DeliveryTransportOption[],
  defaults: { distance_km?: string; total_volume_cm3?: number | null | string }
): {
  payload: DeliveryPricingSummary | null;
  error?: string;
  totalCapacityCm3: number | null;
  totalDeliveryCost: number | null;
  averageCostPerTransport: number | null;
  totalTransportCount: number;
  transports: Array<{
    option: DeliveryTransportOption;
    count: number;
    totalCapacity: number | null;
    totalCost: number | null;
  }>;
} => {
  const totalVolumeCm3 = parseInteger(String(defaults.total_volume_cm3 ?? form.total_volume_cm3));
  const normalizedTransports = form.transports
    .map((item) => {
      const option = options.find(
        (candidate) => candidate.transport_value === item.transport_value
      );
      const count = parseInteger(item.transport_count);
      if (!option || count === undefined || count <= 0) {
        return null;
      }
      return { option, count } as const;
    })
    .filter((item): item is { option: DeliveryTransportOption; count: number } => item !== null);

  if (normalizedTransports.length === 0) {
    return {
      payload: null,
      totalCapacityCm3: null,
      totalDeliveryCost: null,
      averageCostPerTransport: null,
      totalTransportCount: 0,
      transports: [],
    };
  }

  const transports = normalizedTransports.map((item) => ({
    option: item.option,
    count: item.count,
    totalCapacity:
      item.option.transport_capacity_volume_cm3 !== null
        ? item.option.transport_capacity_volume_cm3 * item.count
        : null,
    totalCost:
      item.option.cost_per_transport !== null ? item.option.cost_per_transport * item.count : null,
  }));

  const totalTransportCount = transports.reduce((total, current) => total + current.count, 0);
  const totalCapacityCm3 = transports.reduce(
    (total, current) => total + (current.totalCapacity ?? 0),
    0
  );
  const totalDeliveryCost = transports.reduce(
    (total, current) => total + (current.totalCost ?? 0),
    0
  );
  const averageCostPerTransport =
    totalTransportCount > 0 ? totalDeliveryCost / totalTransportCount : null;
  const requiredMaxCapacity = options.reduce(
    (max, item) => Math.max(max, item.transport_capacity_volume_cm3 ?? 0),
    0
  );
  const selectedMaxCapacity = transports.reduce(
    (max, current) => Math.max(max, current.option.transport_capacity_volume_cm3 ?? 0),
    0
  );

  if (requiredMaxCapacity && selectedMaxCapacity < requiredMaxCapacity) {
    return {
      payload: null,
      error: 'Выбранные типы транспорта не соответствуют требованиям заказа.',
      totalCapacityCm3,
      totalDeliveryCost,
      averageCostPerTransport,
      totalTransportCount,
      transports,
    };
  }

  if (totalVolumeCm3 !== undefined && totalVolumeCm3 > 0 && totalCapacityCm3 < totalVolumeCm3) {
    return {
      payload: null,
      error: 'Выбранные машины не перекрывают требуемый объём заказа.',
      totalCapacityCm3,
      totalDeliveryCost,
      averageCostPerTransport,
      totalTransportCount,
      transports,
    };
  }

  const primaryTransport = transports.reduce((largest, current) => {
    if (
      (largest?.option.transport_capacity_volume_cm3 ?? 0) >=
      (current.option.transport_capacity_volume_cm3 ?? 0)
    ) {
      return largest ?? current;
    }
    return current;
  });

  if (!primaryTransport) {
    return {
      payload: null,
      totalCapacityCm3,
      totalDeliveryCost,
      averageCostPerTransport,
      totalTransportCount,
      transports,
    };
  }

  const payload: DeliveryPricingSummary = {
    transport: {
      value: primaryTransport.option.transport_value,
      label: primaryTransport.option.transport_label,
      capacity_volume_cm3: primaryTransport.option.transport_capacity_volume_cm3 ?? undefined,
    },
    transport_count: totalTransportCount,
    distance_km: defaults.distance_km || undefined,
    cost_per_transport: formatDecimal(averageCostPerTransport ?? undefined),
    total_delivery_cost: formatDecimal(totalDeliveryCost ?? undefined),
    total_volume_cm3: totalVolumeCm3,
    total_capacity_cm3: totalCapacityCm3,
    transports: transports.map((current) => ({
      transport: {
        value: current.option.transport_value,
        label: current.option.transport_label,
        capacity_volume_cm3: current.option.transport_capacity_volume_cm3 ?? undefined,
      },
      transport_count: current.count,
      required_volume_cm3: current.option.required_volume_cm3 ?? undefined,
      capacity_volume_cm3: current.option.transport_capacity_volume_cm3 ?? undefined,
      total_capacity_cm3: current.totalCapacity ?? undefined,
      cost_per_transport: formatDecimal(current.option.cost_per_transport ?? undefined),
      total_cost: formatDecimal(current.totalCost ?? undefined),
    })),
  };

  return {
    payload,
    totalCapacityCm3,
    totalDeliveryCost,
    averageCostPerTransport,
    totalTransportCount,
    transports,
  };
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
  delivery_pricing: DeliveryPricingForm;
};

export default function OrderDetailsPage({ params }: OrderDetailsPageProps) {
  const router = useRouter();
  const { data, isLoading, isError, error } = useOrderQuery(params.orderId);
  const order = data?.data;
  const availableTransports = useMemo(
    () => buildAvailableTransports(order?.delivery_pricing ?? null),
    [order?.delivery_pricing]
  );
  const customerPhone = order?.customer?.phone?.trim() ?? '';
  const canManageOrders = usePermission('orders_change_order');
  const [isServiceTotalsModalOpen, setIsServiceTotalsModalOpen] = useState(false);
  const [serviceTotalsForm, setServiceTotalsForm] = useState<ServiceTotalsFormState>({
    delivery_total_amount: '',
    installation_total_amount: '',
    dismantle_total_amount: '',
    delivery_pricing: buildDeliveryPricingForm(null),
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
      delivery_pricing: buildDeliveryPricingForm(order.delivery_pricing ?? null),
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
    (field: 'delivery_total_amount' | 'installation_total_amount' | 'dismantle_total_amount') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setServiceTotalsForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleDeliveryPricingChange =
    (index: number, field: keyof DeliveryTransportSelection) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { value } = event.target;
      setServiceTotalsForm((prev) => {
        const transports = [...prev.delivery_pricing.transports];
        transports[index] = {
          ...transports[index],
          [field]: value,
        };
        return {
          ...prev,
          delivery_pricing: {
            ...prev.delivery_pricing,
            transports,
          },
        };
      });
    };

  const handleAddTransportRow = () => {
    setServiceTotalsForm((prev) => ({
      ...prev,
      delivery_pricing: {
        ...prev.delivery_pricing,
        transports: [
          ...prev.delivery_pricing.transports,
          {
            transport_value: availableTransports[0]?.transport_value ?? '',
            transport_count: '1',
          },
        ],
      },
    }));
  };

  const handleRemoveTransportRow = (index: number) => () => {
    setServiceTotalsForm((prev) => {
      const transports = prev.delivery_pricing.transports.filter((_, i) => i !== index);
      return {
        ...prev,
        delivery_pricing: {
          ...prev.delivery_pricing,
          transports,
        },
      };
    });
  };

  const handleResetDeliveryPricing = () => {
    setServiceTotalsForm((prev) => ({
      ...prev,
      delivery_pricing: buildDeliveryPricingForm(order?.delivery_pricing ?? null),
    }));
  };

  const normalizeAmountInput = (value: string) => {
    const normalized = value.replace(',', '.').trim();
    return normalized || '0';
  };

  const deliveryPricingEvaluation = useMemo(
    () =>
      evaluateDeliverySelection(serviceTotalsForm.delivery_pricing, availableTransports, {
        distance_km: order?.delivery_pricing?.distance_km,
        total_volume_cm3: order?.delivery_pricing?.total_volume_cm3,
      }),
    [
      availableTransports,
      order?.delivery_pricing?.distance_km,
      order?.delivery_pricing?.total_volume_cm3,
      serviceTotalsForm.delivery_pricing,
    ]
  );

  const handleServiceTotalsSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!order) {
      return;
    }
    setServiceTotalsError(null);
    const deliveryPricing = evaluateDeliverySelection(
      serviceTotalsForm.delivery_pricing,
      availableTransports,
      {
        distance_km: order.delivery_pricing?.distance_km,
        total_volume_cm3: order.delivery_pricing?.total_volume_cm3,
      }
    );
    if (deliveryPricing.error) {
      setServiceTotalsError(deliveryPricing.error);
      return;
    }
    const payload = {
      delivery_total_amount: normalizeAmountInput(serviceTotalsForm.delivery_total_amount),
      installation_total_amount: normalizeAmountInput(serviceTotalsForm.installation_total_amount),
      dismantle_total_amount: normalizeAmountInput(serviceTotalsForm.dismantle_total_amount),
      delivery_pricing: deliveryPricing.payload,
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
                </dl>
                {canManageOrders ? (
                  <div>
                    <Button type="button" variant="ghost" onClick={handleOpenServiceTotalsModal}>
                      Изменить стоимости
                    </Button>
                  </div>
                ) : null}
                {order.delivery_type === 'delivery' ? (
                  <dl style={{ display: 'grid', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        Адрес
                      </dt>
                      <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                        {order.delivery_address || 'Адрес не указан'}
                      </dd>
                    </div>
                  </dl>
                ) : null}
                {order.delivery_pricing ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      padding: '12px',
                      background: 'var(--color-surface-muted)',
                      borderRadius: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        gap: '8px',
                        alignItems: 'center',
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: '1rem' }}>Детали доставки</h3>
                      <Tag tone="info">{order.delivery_pricing.transport.label}</Tag>
                    </div>
                    <dl style={{ display: 'grid', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                          Количество машин
                        </dt>
                        <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                          {order.delivery_pricing.transport_count}
                        </dd>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                          Объём заказа
                        </dt>
                        <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                          {formatVolume(order.delivery_pricing.total_volume_cm3)}
                        </dd>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                          Вмещаемый объём транспорта
                        </dt>
                        <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                          {formatVolume(order.delivery_pricing.total_capacity_cm3)}
                        </dd>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                          Расстояние маршрута
                        </dt>
                        <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                          {formatDistance(order.delivery_pricing.distance_km)}
                        </dd>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                          Средняя стоимость машины
                        </dt>
                        <dd style={{ fontWeight: 600, marginInlineStart: 0 }}>
                          {order.delivery_pricing.cost_per_transport
                            ? formatCurrency(order.delivery_pricing.cost_per_transport)
                            : '—'}
                        </dd>
                      </div>
                    </dl>
                    {order.delivery_pricing.transports?.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <strong style={{ fontSize: '0.95rem' }}>Распределение по машинам</strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {order.delivery_pricing.transports.map((transport, index) => (
                            <div
                              key={`${transport.transport.value}-${index}`}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                gap: '8px',
                                padding: '12px',
                                border: '1px solid var(--color-border)',
                                borderRadius: '12px',
                                background: 'var(--color-surface)',
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span
                                  style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}
                                >
                                  Транспорт
                                </span>
                                <span style={{ fontWeight: 600 }}>{transport.transport.label}</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span
                                  style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}
                                >
                                  Машин
                                </span>
                                <span style={{ fontWeight: 600 }}>{transport.transport_count}</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span
                                  style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}
                                >
                                  Объём заказа
                                </span>
                                <span style={{ fontWeight: 600 }}>
                                  {formatVolume(transport.required_volume_cm3)}
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span
                                  style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}
                                >
                                  Вместимость машин
                                </span>
                                <span style={{ fontWeight: 600 }}>
                                  {formatVolume(transport.total_capacity_cm3)}
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span
                                  style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}
                                >
                                  Стоимость
                                </span>
                                <span style={{ fontWeight: 600 }}>
                                  {transport.total_cost
                                    ? formatCurrency(transport.total_cost)
                                    : '—'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Детали доставки</h3>
              <Button
                type="button"
                variant="ghost"
                onClick={handleResetDeliveryPricing}
                disabled={isSavingServiceTotals}
              >
                Очистить
              </Button>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
              }}
            >
              <Input
                label="Дистанция маршрута, км"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={order?.delivery_pricing?.distance_km ?? ''}
                disabled
              />
              <Input
                label="Объём заказа, см³"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={order?.delivery_pricing?.total_volume_cm3 ?? ''}
                disabled
              />
              <Input
                label="Общая вместимость, см³"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={deliveryPricingEvaluation.totalCapacityCm3 ?? ''}
                disabled
              />
              <Input
                label="Средняя стоимость машины, ₽"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={
                  formatDecimal(deliveryPricingEvaluation.averageCostPerTransport ?? undefined) ??
                  ''
                }
                disabled
              />
              <Input
                label="Итоговая стоимость доставки, ₽"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={
                  formatDecimal(deliveryPricingEvaluation.totalDeliveryCost ?? undefined) ?? ''
                }
                disabled
              />
            </div>
            {availableTransports.length === 0 ? (
              <Alert tone="info" title="Нет доступных транспортов">
                Для этого заказа нет предложенных вариантов транспорта. Проверьте расчёт доставки.
              </Alert>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Машины в рейсе</h4>
              <Button
                type="button"
                variant="ghost"
                onClick={handleAddTransportRow}
                disabled={isSavingServiceTotals || availableTransports.length === 0}
              >
                Добавить машину
              </Button>
            </div>
            {serviceTotalsForm.delivery_pricing.transports.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {serviceTotalsForm.delivery_pricing.transports.map((transport, index) => (
                  <div
                    key={`${transport.transport_value}-${index}`}
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: '12px',
                      padding: '12px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    <Select
                      label="Транспорт"
                      value={transport.transport_value}
                      onChange={handleDeliveryPricingChange(index, 'transport_value')}
                      disabled={isSavingServiceTotals || availableTransports.length === 0}
                      required
                    >
                      <option value="">Выберите транспорт</option>
                      {availableTransports.map((option) => (
                        <option key={option.transport_value} value={option.transport_value}>
                          {option.transport_label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      label="Машин"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={transport.transport_count}
                      onChange={handleDeliveryPricingChange(index, 'transport_count')}
                      disabled={isSavingServiceTotals}
                      required
                    />
                    <Input
                      label="Вместимость машины, см³"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={
                        availableTransports.find(
                          (option) => option.transport_value === transport.transport_value
                        )?.transport_capacity_volume_cm3 ?? ''
                      }
                      disabled
                    />
                    <Input
                      label="Суммарная вместимость, см³"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={
                        deliveryPricingEvaluation.transports.find(
                          (item) => item.option.transport_value === transport.transport_value
                        )?.totalCapacity ?? ''
                      }
                      disabled
                    />
                    <Input
                      label="Стоимость за машину, ₽"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={
                        formatDecimal(
                          availableTransports.find(
                            (option) => option.transport_value === transport.transport_value
                          )?.cost_per_transport ?? undefined
                        ) ?? ''
                      }
                      disabled
                    />
                    <Input
                      label="Стоимость итого, ₽"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={
                        formatDecimal(
                          deliveryPricingEvaluation.transports.find(
                            (item) => item.option.transport_value === transport.transport_value
                          )?.totalCost ?? undefined
                        ) ?? ''
                      }
                      disabled
                    />
                    <div
                      style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleRemoveTransportRow(index)}
                        disabled={isSavingServiceTotals}
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
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

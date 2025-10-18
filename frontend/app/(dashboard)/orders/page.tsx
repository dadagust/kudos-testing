'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';

import {
  ORDER_PRODUCT_OPTIONS,
  ORDER_STATUS_LABELS,
  OrderDeliveryMethod,
  OrderDetail,
  OrderScope,
  OrderStatus,
  OrderSummary,
  useCreateOrderMutation,
  useOrderDetailsQuery,
  useOrdersQuery,
  useUpdateOrderMutation,
} from '@/entities/order';
import { CustomerListQuery, CustomerSummary, useCustomersQuery } from '@/entities/customer';
import { RoleGuard } from '@/features/auth';
import { Role } from '@/shared/config/roles';
import {
  Accordion,
  AccordionItem,
  Alert,
  Badge,
  Button,
  Drawer,
  FormField,
  Input,
  Select,
  Spinner,
  Table,
} from '@/shared/ui';
import type { TableColumn } from '@/shared/ui';

const ORDER_SCOPE_TABS: { value: OrderScope; label: string }[] = [
  { value: 'current', label: 'Текущие' },
  { value: 'archived', label: 'В архиве' },
  { value: 'cancelled', label: 'Отменённые' },
];

const formatDate = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(value));
  } catch (error) {
    return value;
  }
};

const formatCurrency = (value?: string | number) => {
  if (value === undefined || value === null) {
    return '—';
  }
  const amount = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(amount)) {
    return typeof value === 'string' ? value : '—';
  }
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(amount);
};

const resolveStatusTone = (status: OrderStatus) => {
  switch (status) {
    case 'archived':
      return 'warning' as const;
    case 'cancelled':
      return 'danger' as const;
    case 'in_rent':
    case 'in_progress':
      return 'success' as const;
    default:
      return 'info' as const;
  }
};

const deliveryMethodLabel = (method: OrderDeliveryMethod) =>
  method === 'pickup' ? 'Самовывоз' : 'Доставка';

type ProductQuantities = Record<string, number>;

const buildEmptyProducts = (): ProductQuantities =>
  ORDER_PRODUCT_OPTIONS.reduce<ProductQuantities>((acc, option) => {
    acc[option.value] = 0;
    return acc;
  }, {});

interface FormState {
  status: OrderStatus;
  installationDate: string;
  dismantleDate: string;
  customerId: string;
  deliveryMethod: OrderDeliveryMethod;
  deliveryAddress: string;
  comment: string;
  productQuantities: ProductQuantities;
}

const createDefaultFormState = (): FormState => ({
  status: 'new',
  installationDate: '',
  dismantleDate: '',
  customerId: '',
  deliveryMethod: 'delivery',
  deliveryAddress: '',
  comment: '',
  productQuantities: buildEmptyProducts(),
});

const mapOrderToFormState = (order: OrderDetail): FormState => {
  const quantities = buildEmptyProducts();
  order.items.forEach((item) => {
    quantities[item.product] = item.quantity;
  });
  return {
    status: order.status,
    installationDate: order.installation_date,
    dismantleDate: order.dismantle_date,
    customerId: order.customer ?? '',
    deliveryMethod: order.delivery_method,
    deliveryAddress: order.delivery_address ?? '',
    comment: order.comment ?? '',
    productQuantities: quantities,
  };
};

const calculateTotal = (quantities: ProductQuantities) =>
  Object.entries(quantities).reduce((total, [product, quantity]) => {
    const option = ORDER_PRODUCT_OPTIONS.find((item) => item.value === product);
    if (!option) {
      return total;
    }
    return total + option.price * quantity;
  }, 0);

const parseErrorMessage = (
  error: AxiosError<Record<string, unknown> | { detail?: string }>
): string => {
  const detail = error.response?.data;
  if (!detail) {
    return 'Не удалось сохранить заказ. Попробуйте ещё раз.';
  }
  if (typeof detail === 'string') {
    return detail;
  }
  if ('detail' in detail && typeof detail.detail === 'string') {
    return detail.detail;
  }
  const messages = Object.values(detail).flat();
  const first = messages.find((message) => typeof message === 'string');
  return (first as string | undefined) ?? 'Не удалось сохранить заказ. Попробуйте ещё раз.';
};

export default function OrdersPage() {
  const [scope, setScope] = useState<OrderScope>('current');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [formState, setFormState] = useState<FormState>(createDefaultFormState);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const ordersParams = useMemo(() => ({ scope }), [scope]);
  const ordersQuery = useOrdersQuery(ordersParams);
  const orders = ordersQuery.data?.data ?? [];

  const selectedOrderQuery = useOrderDetailsQuery(selectedOrderId);
  const selectedOrder = selectedOrderQuery.data?.data ?? null;

  const editingOrderQuery = useOrderDetailsQuery(editingOrderId);
  const editingOrder = editingOrderQuery.data?.data ?? null;

  const customerQueryParams = useMemo<CustomerListQuery>(
    () => ({ page: 1, page_size: 50, search: customerSearch || undefined, sort: 'display_name' }),
    [customerSearch]
  );
  const customersQuery = useCustomersQuery(customerQueryParams);
  const customers = customersQuery.data?.data ?? [];

  const filteredProducts = useMemo(
    () =>
      ORDER_PRODUCT_OPTIONS.filter((option) =>
        option.label.toLowerCase().includes(productSearch.trim().toLowerCase())
      ),
    [productSearch]
  );

  const formTotal = useMemo(
    () => calculateTotal(formState.productQuantities),
    [formState.productQuantities]
  );

  useEffect(() => {
    if (!isFormOpen) {
      return;
    }
    if (editingOrderId && editingOrder) {
      setFormState(mapOrderToFormState(editingOrder));
    }
    if (!editingOrderId) {
      setFormState(createDefaultFormState());
    }
  }, [editingOrder, editingOrderId, isFormOpen]);

  const createOrderMutation = useCreateOrderMutation();
  const updateOrderMutation = useUpdateOrderMutation();
  const isSubmitting = createOrderMutation.isPending || updateOrderMutation.isPending;

  const handleOpenCreate = () => {
    setEditingOrderId(null);
    setFormState(createDefaultFormState());
    setCustomerSearch('');
    setProductSearch('');
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (orderId: number, order?: OrderDetail | null) => {
    setEditingOrderId(orderId);
    if (order) {
      setFormState(mapOrderToFormState(order));
    }
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingOrderId(null);
    setFormState(createDefaultFormState());
    setCustomerSearch('');
    setProductSearch('');
    setFormError(null);
  };

  const handleQuantityChange = (product: string, delta: number) => {
    setFormState((prev) => {
      const current = prev.productQuantities[product] ?? 0;
      const next = Math.max(0, current + delta);
      return {
        ...prev,
        productQuantities: {
          ...prev.productQuantities,
          [product]: next,
        },
      };
    });
  };

  const handleCustomerSelect = (customer: CustomerSummary | null) => {
    setFormState((prev) => ({
      ...prev,
      customerId: customer ? customer.id : '',
    }));
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!formState.installationDate || !formState.dismantleDate) {
      setFormError('Укажите даты монтажа и демонтажа.');
      return;
    }

    if (
      formState.deliveryMethod === 'delivery' &&
      formState.deliveryAddress.trim().length === 0
    ) {
      setFormError('Укажите адрес доставки или выберите самовывоз.');
      return;
    }

    const items = Object.entries(formState.productQuantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([product, quantity]) => ({ product, quantity }));

    if (!items.length) {
      setFormError('Добавьте хотя бы один товар.');
      return;
    }

    const payload = {
      status: formState.status,
      installation_date: formState.installationDate,
      dismantle_date: formState.dismantleDate,
      customer_id: formState.customerId ? formState.customerId : null,
      delivery_method: formState.deliveryMethod,
      delivery_address:
        formState.deliveryMethod === 'delivery' ? formState.deliveryAddress : '',
      comment: formState.comment || undefined,
      items,
    };

    const handleSuccess = (response: { data: OrderDetail }) => {
      handleFormClose();
      setSelectedOrderId(response.data.id);
    };

    const handleError = (error: AxiosError<Record<string, unknown> | { detail?: string }>) => {
      setFormError(parseErrorMessage(error));
    };

    if (editingOrderId) {
      updateOrderMutation.mutate({ orderId: editingOrderId, payload }, {
        onSuccess: handleSuccess,
        onError: handleError,
      });
    } else {
      createOrderMutation.mutate(payload, {
        onSuccess: handleSuccess,
        onError: handleError,
      });
    }
  };

  const columns: TableColumn<OrderSummary>[] = useMemo(
    () => [
      { key: 'number', header: 'Номер' },
      {
        key: 'status',
        header: 'Статус',
        render: (row) => (
          <Badge tone={resolveStatusTone(row.status)}>{ORDER_STATUS_LABELS[row.status]}</Badge>
        ),
      },
      {
        key: 'total_amount',
        header: 'Сумма',
        render: (row) => formatCurrency(row.total_amount),
      },
      {
        key: 'installation_date',
        header: 'Монтаж',
        render: (row) => formatDate(row.installation_date),
      },
      {
        key: 'dismantle_date',
        header: 'Демонтаж',
        render: (row) => formatDate(row.dismantle_date),
      },
      {
        key: 'customer_name',
        header: 'Клиент',
        render: (row) => row.customer_name || '—',
      },
      {
        key: 'actions',
        header: ' ',
        render: (row) => (
          <Button variant="ghost" onClick={() => setSelectedOrderId(row.id)}>
            Открыть
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <RoleGuard allow={[Role.SalesManager, Role.Warehouse, Role.Accountant, Role.Admin]}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Заказы</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Управляйте текущими, архивными и отменёнными заказами без перезагрузки страницы.
          </p>
        </div>
        <Button onClick={handleOpenCreate}>Создать заказ</Button>
      </div>

      <div style={{ display: 'flex', gap: '8px', margin: '24px 0' }}>
        {ORDER_SCOPE_TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={scope === tab.value ? 'primary' : 'ghost'}
            onClick={() => setScope(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {ordersQuery.isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <Spinner />
        </div>
      ) : null}

      {ordersQuery.error ? (
        <Alert tone="danger">
          Не удалось загрузить список заказов. Обновите страницу или повторите попытку позже.
        </Alert>
      ) : null}

      <Table
        columns={columns}
        data={orders}
        emptyMessage={
          ordersQuery.isLoading ? 'Загрузка данных...' : 'Заказы в выбранной категории не найдены.'
        }
      />

      <Drawer open={Boolean(selectedOrderId)} onClose={() => setSelectedOrderId(null)}>
        {selectedOrderQuery.isLoading ? (
          <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}>
            <Spinner />
          </div>
        ) : null}
        {selectedOrder ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ marginBottom: '4px' }}>{selectedOrder.number}</h2>
                <Badge tone={resolveStatusTone(selectedOrder.status)}>
                  {ORDER_STATUS_LABELS[selectedOrder.status]}
                </Badge>
              </div>
              <Button onClick={() => handleOpenEdit(selectedOrder.id, selectedOrder)}>Редактировать</Button>
            </header>

            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <strong>Клиент:</strong> {selectedOrder.customer_name}
              </div>
              <div>
                <strong>Сумма:</strong> {formatCurrency(selectedOrder.total_amount)}
              </div>
              <div>
                <strong>Дата монтажа:</strong> {formatDate(selectedOrder.installation_date)}
              </div>
              <div>
                <strong>Дата демонтажа:</strong> {formatDate(selectedOrder.dismantle_date)}
              </div>
              <div>
                <strong>Доставка:</strong> {deliveryMethodLabel(selectedOrder.delivery_method)}
              </div>
              <div>
                <strong>Адрес:</strong>{' '}
                {selectedOrder.delivery_method === 'pickup'
                  ? 'Самовывоз'
                  : selectedOrder.delivery_address || '—'}
              </div>
              <div>
                <strong>Комментарий:</strong> {selectedOrder.comment || '—'}
              </div>
            </div>

            <section>
              <h3 style={{ marginBottom: '8px' }}>Товары</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedOrder.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      background: 'var(--color-surface-muted)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                    }}
                  >
                    <span>
                      {item.product_label} × {item.quantity}
                    </span>
                    <span>{formatCurrency(item.total_price)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </Drawer>

      <Drawer open={isFormOpen} onClose={handleFormClose}>
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2>{editingOrderId ? 'Редактирование заказа' : 'Новый заказ'}</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <FormField label="Статус">
              <Select
                value={formState.status}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, status: event.target.value as OrderStatus }))
                }
              >
                {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Дата монтажа">
              <Input
                type="date"
                value={formState.installationDate}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, installationDate: event.target.value }))
                }
              />
            </FormField>

            <FormField label="Дата демонтажа">
              <Input
                type="date"
                value={formState.dismantleDate}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, dismantleDate: event.target.value }))
                }
              />
            </FormField>

            <FormField label="Способ доставки">
              <Select
                value={formState.deliveryMethod}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    deliveryMethod: event.target.value as OrderDeliveryMethod,
                  }))
                }
              >
                <option value="delivery">Доставка</option>
                <option value="pickup">Самовывоз</option>
              </Select>
            </FormField>

            <FormField label="Адрес доставки">
              <Input
                value={formState.deliveryAddress}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, deliveryAddress: event.target.value }))
                }
                disabled={formState.deliveryMethod === 'pickup'}
                placeholder="Город, улица, дом"
              />
            </FormField>
          </div>

          <FormField label="Комментарий">
            <Input
              value={formState.comment}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, comment: event.target.value }))
              }
              placeholder="Дополнительные пожелания"
            />
          </FormField>

          <Accordion>
            <AccordionItem title="Клиенты" defaultOpen>
              <Input
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Поиск клиента"
              />
              {customersQuery.isLoading ? (
                <Spinner />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Button
                    variant={formState.customerId ? 'ghost' : 'primary'}
                    onClick={() => handleCustomerSelect(null)}
                    type="button"
                  >
                    Без клиента
                  </Button>
                  {customers.map((customer: CustomerSummary) => (
                    <Button
                      key={customer.id}
                      variant={formState.customerId === customer.id ? 'primary' : 'ghost'}
                      onClick={() => handleCustomerSelect(customer)}
                      type="button"
                    >
                      {customer.display_name || customer.full_name || 'Без имени'}
                    </Button>
                  ))}
                </div>
              )}
            </AccordionItem>

            <AccordionItem title="Товары" defaultOpen>
              <Input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Поиск товара"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredProducts.map((product) => {
                  const quantity = formState.productQuantities[product.value] ?? 0;
                  return (
                    <div
                      key={product.value}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong>{product.label}</strong>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                          {formatCurrency(product.price)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => handleQuantityChange(product.value, -1)}
                        >
                          −
                        </Button>
                        <span style={{ minWidth: '32px', textAlign: 'center' }}>{quantity}</span>
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => handleQuantityChange(product.value, 1)}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </AccordionItem>
          </Accordion>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--color-surface-muted)',
              padding: '12px 16px',
              borderRadius: '8px',
            }}
          >
            <span>Итого:</span>
            <strong>{formatCurrency(formTotal)}</strong>
          </div>

          {formError ? <Alert tone="danger">{formError}</Alert> : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button variant="ghost" type="button" onClick={handleFormClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Сохранение…' : editingOrderId ? 'Сохранить изменения' : 'Создать заказ'}
            </Button>
          </div>
        </form>
      </Drawer>
    </RoleGuard>
  );
}

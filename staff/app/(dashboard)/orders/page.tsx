'use client';

import clsx from 'clsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChangeEvent,
  Dispatch,
  FormEvent,
  ReactNode,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { RoleGuard, usePermission } from '@/features/auth';
import { customersApi, CustomerSummary } from '@/entities/customer';
import {
  CreateOrderPayload,
  DeliveryOption,
  OrderDetail,
  OrderProductCode,
  OrderProductOption,
  OrderStatus,
  OrderSummary,
  useCreateOrderMutation,
  useOrderQuery,
  useOrdersQuery,
  useUpdateOrderMutation,
} from '@/entities/order';
import { Alert, Badge, Button, Drawer, Input, Select, Spinner, Table } from '@/shared/ui';
import type { TableColumn } from '@/shared/ui';

import styles from './orders.module.sass';

const ORDER_STATUS_GROUPS: Record<
  'current' | 'archived' | 'cancelled',
  { label: string; statuses: OrderStatus[] }
> = {
  current: {
    label: 'Текущие',
    statuses: ['new', 'reserved', 'in_rent', 'in_progress'],
  },
  archived: {
    label: 'В архиве',
    statuses: ['archived'],
  },
  cancelled: {
    label: 'Отмененные',
    statuses: ['cancelled'],
  },
};

type StatusGroupKey = keyof typeof ORDER_STATUS_GROUPS;

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Новый',
  reserved: 'В резерве',
  in_rent: 'В аренде',
  in_progress: 'В работе',
  archived: 'Архив',
  cancelled: 'Отказ',
};

const STATUS_TONE: Record<OrderStatus, 'success' | 'warning' | 'danger' | 'info'> = {
  new: 'info',
  reserved: 'warning',
  in_rent: 'success',
  in_progress: 'info',
  archived: 'success',
  cancelled: 'danger',
};

const DELIVERY_LABELS: Record<DeliveryOption, string> = {
  delivery: 'Доставка',
  pickup: 'Самовывоз',
};

const PRODUCT_OPTIONS: OrderProductOption[] = [
  { code: 'product_1', name: 'Товар 1', price: 1500 },
  { code: 'product_2', name: 'Товар 2', price: 3200 },
];

const PRODUCT_PRICE: Record<OrderProductCode, number> = PRODUCT_OPTIONS.reduce(
  (acc, product) => ({ ...acc, [product.code]: product.price }),
  {} as Record<OrderProductCode, number>
);

interface OrderItemFormState {
  id?: number;
  product: OrderProductCode;
  quantity: number;
}

interface OrderFormState {
  status: OrderStatus;
  installation_date: string;
  dismantle_date: string;
  customer_id: string | null;
  customer_name: string;
  delivery_option: DeliveryOption;
  delivery_address: string;
  comment: string;
  items: OrderItemFormState[];
}

const createInitialFormState = (): OrderFormState => ({
  status: 'new',
  installation_date: '',
  dismantle_date: '',
  customer_id: null,
  customer_name: '',
  delivery_option: 'delivery',
  delivery_address: '',
  comment: '',
  items: [{ product: 'product_1', quantity: 1 }],
});

const formatCurrency = (value: string | number) => {
  const amount = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(amount)) {
    return '—';
  }
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (value: string) => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('ru-RU');
};

const calculateItemsTotal = (items: OrderItemFormState[]) =>
  items.reduce((total, item) => total + item.quantity * (PRODUCT_PRICE[item.product] ?? 0), 0);

const mapOrderToForm = (order: OrderDetail): OrderFormState => ({
  status: order.status,
  installation_date: order.installation_date,
  dismantle_date: order.dismantle_date,
  customer_id: order.customer ?? null,
  customer_name: order.customer_name ?? '',
  delivery_option: order.delivery_option,
  delivery_address: order.delivery_address ?? '',
  comment: order.comment ?? '',
  items: order.items.map((item) => ({
    id: item.id,
    product: item.product,
    quantity: item.quantity,
  })),
});

const buildPayloadFromForm = (form: OrderFormState): CreateOrderPayload => {
  const items = form.items.filter((item) => item.quantity > 0);

  return {
    status: form.status,
    installation_date: form.installation_date,
    dismantle_date: form.dismantle_date,
    customer: form.customer_id,
    delivery_option: form.delivery_option,
    delivery_address:
      form.delivery_option === 'delivery' ? form.delivery_address.trim() || undefined : '',
    comment: form.comment.trim() ? form.comment.trim() : undefined,
    items: items.map((item) => ({
      id: item.id,
      product: item.product,
      quantity: item.quantity,
    })),
  };
};

interface AccordionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

const Accordion = ({ title, subtitle, children, defaultOpen = false }: AccordionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={styles.accordion}>
      <button
        type="button"
        className={styles.accordionHeader}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>{title}</span>
        <span>{subtitle}</span>
      </button>
      {isOpen ? <div className={styles.accordionContent}>{children}</div> : null}
    </div>
  );
};

const useCustomerLookup = (search: string, enabled: boolean) =>
  useQuery({
    queryKey: ['customers', 'lookup', search] as const,
    queryFn: () =>
      customersApi.list({
        search,
        page: 1,
        page_size: 20,
        sort: 'name',
      }),
    enabled,
    staleTime: 60_000,
  });

export default function OrdersPage() {
  const [activeGroup, setActiveGroup] = useState<StatusGroupKey>('current');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<OrderFormState>(() => createInitialFormState());
  const [createError, setCreateError] = useState<string | null>(null);
  const [createCustomerSearch, setCreateCustomerSearch] = useState('');
  const [createProductSearch, setCreateProductSearch] = useState('');

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<OrderFormState>(() => createInitialFormState());
  const [editOrderId, setEditOrderId] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editCustomerSearch, setEditCustomerSearch] = useState('');
  const [editProductSearch, setEditProductSearch] = useState('');

  const queryClient = useQueryClient();
  const canManageOrders = usePermission('orders', 'change');

  const listParams = useMemo(
    () => ({
      status: ORDER_STATUS_GROUPS[activeGroup].statuses,
      search: searchTerm.trim() || undefined,
    }),
    [activeGroup, searchTerm]
  );

  const {
    data: ordersResponse,
    isLoading,
    isError,
    error,
    isFetching,
  } = useOrdersQuery(listParams);

  const orders = ordersResponse?.data ?? [];

  const {
    data: selectedOrderResponse,
    isLoading: isSelectedOrderLoading,
  } = useOrderQuery(selectedOrderId ?? 0, Boolean(selectedOrderId));

  const selectedOrder = selectedOrderResponse?.data ?? null;

  const createMutation = useCreateOrderMutation();
  const updateMutation = useUpdateOrderMutation();

  const {
    data: createCustomers,
    isLoading: isCreateCustomersLoading,
  } = useCustomerLookup(createCustomerSearch, isCreateOpen);

  const {
    data: editCustomers,
    isLoading: isEditCustomersLoading,
  } = useCustomerLookup(editCustomerSearch, isEditOpen);

  const handleTabClick = useCallback((key: StatusGroupKey) => {
    setActiveGroup(key);
    setSelectedOrderId(null);
  }, []);

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  }, []);

  const handleOrderSelect = useCallback((order: OrderSummary) => {
    setSelectedOrderId(order.id);
  }, []);

  const handleResetCreateForm = useCallback(() => {
    setCreateForm(createInitialFormState());
    setCreateError(null);
    setCreateCustomerSearch('');
    setCreateProductSearch('');
  }, []);

  const handleCloseCreate = useCallback(() => {
    setIsCreateOpen(false);
    handleResetCreateForm();
  }, [handleResetCreateForm]);

  const handleOpenCreate = useCallback(() => {
    handleResetCreateForm();
    setIsCreateOpen(true);
  }, [handleResetCreateForm]);

  const handleCreateFieldChange = useCallback(
    (field: keyof OrderFormState) =>
      (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const value = event.target.value;
        setCreateForm((prev) => ({
          ...prev,
          [field]:
            field === 'status'
              ? (value as OrderStatus)
              : field === 'delivery_option'
                ? (value as DeliveryOption)
                : value,
        }));
      },
    []
  );

  const handleEditFieldChange = useCallback(
    (field: keyof OrderFormState) =>
      (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const value = event.target.value;
        setEditForm((prev) => ({
          ...prev,
          [field]:
            field === 'status'
              ? (value as OrderStatus)
              : field === 'delivery_option'
                ? (value as DeliveryOption)
                : value,
        }));
      },
    []
  );

  const updateProductQuantity = useCallback(
    (setter: Dispatch<SetStateAction<OrderFormState>>, product: OrderProductCode, quantity: number) => {
      setter((prev) => {
        const existing = prev.items.find((item) => item.product === product);
        const nextItems = prev.items.filter((item) => item.product !== product);
        if (quantity > 0) {
          nextItems.push({ id: existing?.id, product, quantity });
        }
        return {
          ...prev,
          items: nextItems,
        };
      });
    },
    []
  );

  const handleSelectCustomer = useCallback(
    (setter: Dispatch<SetStateAction<OrderFormState>>, customer: CustomerSummary | null) => {
      setter((prev) => ({
        ...prev,
        customer_id: customer?.id ?? null,
        customer_name: customer?.display_name ?? customer?.full_name ?? '',
      }));
    },
    []
  );

  const handleSubmitCreate = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setCreateError(null);

      const payload = buildPayloadFromForm(createForm);
      createMutation.mutate(payload, {
        onSuccess: (response) => {
          handleCloseCreate();
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          if (response.data?.id) {
            setSelectedOrderId(response.data.id);
          }
        },
        onError: (mutationError) => {
          setCreateError(mutationError.message || 'Не удалось создать заказ.');
        },
      });
    },
    [createForm, createMutation, handleCloseCreate, queryClient]
  );

  const handleOpenEdit = useCallback(() => {
    if (!selectedOrder) {
      return;
    }
    setEditForm(mapOrderToForm(selectedOrder));
    setEditOrderId(selectedOrder.id);
    setEditError(null);
    setEditCustomerSearch('');
    setEditProductSearch('');
    setIsEditOpen(true);
  }, [selectedOrder]);

  const handleCloseEdit = useCallback(() => {
    setIsEditOpen(false);
    setEditOrderId(null);
  }, []);

  const handleSubmitEdit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!editOrderId) {
        return;
      }
      setEditError(null);
      const payload = buildPayloadFromForm(editForm);
      updateMutation.mutate(
        { orderId: editOrderId, payload },
        {
          onSuccess: () => {
            handleCloseEdit();
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            if (selectedOrderId) {
              queryClient.invalidateQueries({ queryKey: ['order', selectedOrderId] });
            }
          },
          onError: (mutationError) => {
            setEditError(mutationError.message || 'Не удалось обновить заказ.');
          },
        }
      );
    },
    [editForm, editOrderId, updateMutation, handleCloseEdit, queryClient, selectedOrderId]
  );

  const renderOrderActions = useCallback(
    (row: OrderSummary) => (
      <Button variant="ghost" onClick={() => handleOrderSelect(row)}>
        Подробнее
      </Button>
    ),
    [handleOrderSelect]
  );

  const columns: TableColumn<OrderSummary>[] = useMemo(
    () => [
      { key: 'id', header: 'Номер' },
      {
        key: 'status',
        header: 'Статус',
        render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status_label}</Badge>,
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
        key: 'delivery_address',
        header: 'Адрес/Получение',
        render: (row) =>
          row.delivery_option === 'pickup' ? 'Самовывоз' : row.delivery_address || '—',
      },
      {
        key: 'comment',
        header: 'Комментарий',
        render: (row) => row.comment || '—',
      },
      {
        key: 'actions',
        header: '',
        render: renderOrderActions,
      },
    ],
    [renderOrderActions]
  );

  const renderProductList = (
    form: OrderFormState,
    setForm: Dispatch<SetStateAction<OrderFormState>>,
    search: string,
    onSearchChange: (value: string) => void
  ) => {
    const filtered = PRODUCT_OPTIONS.filter((product) =>
      product.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <>
        <Input
          label="Поиск"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Найти товар"
        />
        <div className={styles.lookupList}>
          {filtered.length ? (
            filtered.map((product) => {
              const existing = form.items.find((item) => item.product === product.code);
              return (
                <div key={product.code} className={styles.lookupItem}>
                  <div className={styles.itemInfo}>
                    <strong>{product.name}</strong>
                    <span>{formatCurrency(product.price)}</span>
                  </div>
                  <div className={styles.itemControls}>
                    <Input
                      type="number"
                      min={0}
                      value={String(existing?.quantity ?? 0)}
                      onChange={(event) =>
                        updateProductQuantity(
                          setForm,
                          product.code,
                          Number.isNaN(Number.parseInt(event.target.value, 10))
                            ? 0
                            : Math.max(0, Number.parseInt(event.target.value, 10))
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      onClick={() =>
                        updateProductQuantity(
                          setForm,
                          product.code,
                          (existing?.quantity ?? 0) + 1
                        )
                      }
                    >
                      Добавить
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <span className={styles.emptyLookup}>Нет подходящих товаров.</span>
          )}
        </div>
        <div className={styles.totalRow}>
          <span>Сумма заказа</span>
          <span>{formatCurrency(calculateItemsTotal(form.items))}</span>
        </div>
      </>
    );
  };

  const renderCustomerLookup = (
    form: OrderFormState,
    setForm: Dispatch<SetStateAction<OrderFormState>>,
    search: string,
    onSearchChange: (value: string) => void,
    options: CustomerSummary[] | undefined,
    isLoadingOptions: boolean
  ) => (
    <>
      <Input
        label="Поиск"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Введите имя или email"
      />
      <div className={styles.lookupList}>
        {isLoadingOptions ? (
          <Spinner />
        ) : options && options.length ? (
          options.map((customer) => (
            <div key={customer.id} className={styles.lookupItem}>
              <div>
                <strong>{customer.display_name || customer.full_name}</strong>
                <div className={styles.detailLabel}>{customer.email || customer.phone || '—'}</div>
              </div>
              <div className={styles.lookupActions}>
                <Button variant="ghost" onClick={() => handleSelectCustomer(setForm, customer)}>
                  Выбрать
                </Button>
              </div>
            </div>
          ))
        ) : (
          <span className={styles.emptyLookup}>Клиенты не найдены.</span>
        )}
      </div>
      <Button variant="ghost" onClick={() => handleSelectCustomer(setForm, null)}>
        Очистить выбор
      </Button>
      {form.customer_name ? <div>Выбран: {form.customer_name}</div> : <div>Клиент не выбран</div>}
    </>
  );

  return (
    <RoleGuard allow={[{ scope: 'admin_orders' }, { scope: 'orders' }]}>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <h1>Заказы</h1>
            <p>Управляйте текущими заказами, архивом и отмененными заявками.</p>
          </div>
          <div className={styles.actions}>
            <Input
              className={styles.searchInput}
              placeholder="Поиск по номеру или комментарию"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            {canManageOrders ? (
              <Button iconLeft="plus" onClick={handleOpenCreate}>
                Новый заказ
              </Button>
            ) : null}
          </div>
        </header>

        <div className={styles.tabs}>
          {(Object.keys(ORDER_STATUS_GROUPS) as StatusGroupKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={clsx(styles.tabButton, activeGroup === key && styles.tabButtonActive)}
              onClick={() => handleTabClick(key)}
            >
              {ORDER_STATUS_GROUPS[key].label}
            </button>
          ))}
        </div>

        {isError ? (
          <Alert tone="danger" title="Не удалось загрузить заказы">
            {error?.message ?? 'Произошла ошибка при загрузке списка заказов.'}
          </Alert>
        ) : null}

        <div className={styles.tableWrapper}>
          {isLoading ? <Spinner /> : null}
          <Table
            columns={columns}
            data={orders}
            emptyMessage={isLoading || isFetching ? 'Загрузка...' : 'Заказы отсутствуют.'}
          />
        </div>

        <Drawer open={Boolean(selectedOrderId)} onClose={() => setSelectedOrderId(null)}>
          {isSelectedOrderLoading ? (
            <Spinner />
          ) : selectedOrder ? (
            <div className={styles.form}>
              <h2>Заказ №{selectedOrder.id}</h2>
              <div className={styles.detailSection}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Статус</span>
                  <span className={styles.detailValue}>
                    <Badge tone={STATUS_TONE[selectedOrder.status]}>
                      {selectedOrder.status_label}
                    </Badge>
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Монтаж</span>
                  <span className={styles.detailValue}>{formatDate(selectedOrder.installation_date)}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Демонтаж</span>
                  <span className={styles.detailValue}>{formatDate(selectedOrder.dismantle_date)}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Клиент</span>
                  <span className={styles.detailValue}>{selectedOrder.customer_name || '—'}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Получение</span>
                  <span className={styles.detailValue}>
                    {selectedOrder.delivery_option === 'pickup'
                      ? 'Самовывоз'
                      : selectedOrder.delivery_address || '—'}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Комментарий</span>
                  <span className={styles.detailValue}>{selectedOrder.comment || '—'}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Сумма</span>
                  <span className={styles.detailValue}>{formatCurrency(selectedOrder.total_amount)}</span>
                </div>
              </div>

              <div>
                <h3>Товары</h3>
                <div className={styles.itemsList}>
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className={styles.itemRow}>
                      <div className={styles.itemInfo}>
                        <strong>{item.product_label}</strong>
                        <span>Количество: {item.quantity}</span>
                      </div>
                      <div>
                        <span>{formatCurrency(item.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {canManageOrders ? (
                <div className={styles.drawerFooter}>
                  <Button variant="ghost" onClick={handleOpenEdit}>
                    Редактировать
                  </Button>
                  <Button onClick={() => setSelectedOrderId(null)}>Закрыть</Button>
                </div>
              ) : (
                <div className={styles.drawerFooter}>
                  <Button onClick={() => setSelectedOrderId(null)}>Закрыть</Button>
                </div>
              )}
            </div>
          ) : (
            <Alert tone="info" title="Заказ не найден" />
          )}
        </Drawer>

        <Drawer open={isCreateOpen} onClose={handleCloseCreate}>
          <form className={styles.form} onSubmit={handleSubmitCreate}>
            <h2>Новый заказ</h2>
            {createError ? <Alert tone="danger">{createError}</Alert> : null}
            <div className={styles.formRow}>
              <Select
                label="Статус"
                value={createForm.status}
                onChange={handleCreateFieldChange('status')}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Input
                type="date"
                label="Дата монтажа"
                value={createForm.installation_date}
                onChange={handleCreateFieldChange('installation_date')}
                required
              />
              <Input
                type="date"
                label="Дата демонтажа"
                value={createForm.dismantle_date}
                onChange={handleCreateFieldChange('dismantle_date')}
                required
              />
            </div>
            <div className={styles.formRow}>
              <Select
                label="Способ получения"
                value={createForm.delivery_option}
                onChange={handleCreateFieldChange('delivery_option')}
              >
                {Object.entries(DELIVERY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Input
                label="Адрес доставки"
                value={createForm.delivery_address}
                onChange={handleCreateFieldChange('delivery_address')}
                placeholder="Москва, ул. Примерная, д.1"
                disabled={createForm.delivery_option === 'pickup'}
                required={createForm.delivery_option === 'delivery'}
              />
            </div>
            <textarea
              className={styles.textarea}
              placeholder="Комментарий"
              value={createForm.comment}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  comment: event.target.value,
                }))
              }
            />

            <Accordion title="Клиент" subtitle={createForm.customer_name || 'Не выбран'} defaultOpen>
              {renderCustomerLookup(
                createForm,
                setCreateForm,
                createCustomerSearch,
                setCreateCustomerSearch,
                createCustomers?.data ?? [],
                isCreateCustomersLoading
              )}
            </Accordion>

            <Accordion title="Товары" subtitle={formatCurrency(calculateItemsTotal(createForm.items))} defaultOpen>
              {renderProductList(createForm, setCreateForm, createProductSearch, setCreateProductSearch)}
            </Accordion>

            <div className={styles.drawerFooter}>
              <Button type="submit" disabled={createMutation.isLoading}>
                {createMutation.isLoading ? 'Создание…' : 'Создать заказ'}
              </Button>
              <Button type="button" variant="ghost" onClick={handleCloseCreate}>
                Отменить
              </Button>
            </div>
          </form>
        </Drawer>

        <Drawer open={isEditOpen} onClose={handleCloseEdit}>
          <form className={styles.form} onSubmit={handleSubmitEdit}>
            <h2>Редактирование заказа</h2>
            {editError ? <Alert tone="danger">{editError}</Alert> : null}
            <div className={styles.formRow}>
              <Select label="Статус" value={editForm.status} onChange={handleEditFieldChange('status')}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Input
                type="date"
                label="Дата монтажа"
                value={editForm.installation_date}
                onChange={handleEditFieldChange('installation_date')}
                required
              />
              <Input
                type="date"
                label="Дата демонтажа"
                value={editForm.dismantle_date}
                onChange={handleEditFieldChange('dismantle_date')}
                required
              />
            </div>
            <div className={styles.formRow}>
              <Select
                label="Способ получения"
                value={editForm.delivery_option}
                onChange={handleEditFieldChange('delivery_option')}
              >
                {Object.entries(DELIVERY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Input
                label="Адрес доставки"
                value={editForm.delivery_address}
                onChange={handleEditFieldChange('delivery_address')}
                placeholder="Москва, ул. Примерная, д.1"
                disabled={editForm.delivery_option === 'pickup'}
                required={editForm.delivery_option === 'delivery'}
              />
            </div>
            <textarea
              className={styles.textarea}
              placeholder="Комментарий"
              value={editForm.comment}
              onChange={(event) =>
                setEditForm((prev) => ({
                  ...prev,
                  comment: event.target.value,
                }))
              }
            />

            <Accordion title="Клиент" subtitle={editForm.customer_name || 'Не выбран'} defaultOpen>
              {renderCustomerLookup(
                editForm,
                setEditForm,
                editCustomerSearch,
                setEditCustomerSearch,
                editCustomers?.data ?? [],
                isEditCustomersLoading
              )}
            </Accordion>

            <Accordion title="Товары" subtitle={formatCurrency(calculateItemsTotal(editForm.items))} defaultOpen>
              {renderProductList(editForm, setEditForm, editProductSearch, setEditProductSearch)}
            </Accordion>

            <div className={styles.drawerFooter}>
              <Button type="submit" disabled={updateMutation.isLoading}>
                {updateMutation.isLoading ? 'Сохранение…' : 'Сохранить изменения'}
              </Button>
              <Button type="button" variant="ghost" onClick={handleCloseEdit}>
                Отменить
              </Button>
            </div>
          </form>
        </Drawer>
      </div>
    </RoleGuard>
  );
}

'use client';

import Link from 'next/link';
import {
  ChangeEvent,
  Dispatch,
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { CustomerSummary as CustomerEntitySummary, useCustomersQuery } from '@/entities/customer';
import {
  CreateOrderPayload,
  CustomerSummary,
  DeliveryType,
  ORDER_STATUS_LABELS,
  OrderStatus,
  OrderStatusGroup,
  OrderSummary,
  useCreateOrderMutation,
  useOrderQuery,
  useOrdersQuery,
  useUpdateOrderMutation,
} from '@/entities/order';
import { ProductListItem, useInfiniteProductsQuery } from '@/entities/product';
import { RoleGuard, usePermission } from '@/features/auth';
import { calculateRentalTotal } from '@/shared/lib/rental';
import type { TableColumn } from '@/shared/ui';
import {
  Accordion,
  Alert,
  Button,
  Drawer,
  FormField,
  Input,
  Select,
  Spinner,
  Table,
  Tag,
} from '@/shared/ui';

type CustomerOption = CustomerSummary | CustomerEntitySummary;

type OrderFormState = {
  status: OrderStatus;
  installation_date: string;
  dismantle_date: string;
  customer: CustomerOption | null;
  delivery_type: DeliveryType;
  delivery_address: string;
  comment: string;
  productQuantities: Record<string, number>;
};

type OrderFormSetter = Dispatch<React.SetStateAction<OrderFormState>>;

const STATUS_GROUP_TABS: { id: OrderStatusGroup; label: string }[] = [
  { id: 'current', label: 'Текущие' },
  { id: 'archived', label: 'В архиве' },
  { id: 'cancelled', label: 'Отмененные' },
];

const STATUS_TAG_TONES: Record<OrderStatus, 'default' | 'info' | 'success' | 'warning' | 'danger'> =
  {
    new: 'info',
    reserved: 'warning',
    rented: 'success',
    in_work: 'info',
    archived: 'default',
    declined: 'danger',
  };

const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 2,
});

const coerceProductColor = (value: unknown): ProductListItem['color'] =>
  (value ?? null) as unknown as ProductListItem['color'];

const formatCurrency = (value: number | string) => {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(amount)) {
    return '—';
  }
  return currencyFormatter.format(amount);
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

const createInitialFormState = (): OrderFormState => ({
  status: 'new',
  installation_date: '',
  dismantle_date: '',
  customer: null,
  delivery_type: 'delivery',
  delivery_address: '',
  comment: '',
  productQuantities: {},
});

const calculateRentalDays = (installation: string, dismantle: string): number | null => {
  if (!installation || !dismantle) {
    return null;
  }

  const start = new Date(installation);
  const end = new Date(dismantle);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const totalDays = diffDays + 1;

  if (totalDays <= 0) {
    return null;
  }

  return totalDays;
};

interface OrderFormContentProps {
  title: string;
  submitLabel: string;
  form: OrderFormState;
  setForm: OrderFormSetter;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  error: string | null;
  isSubmitting: boolean;
  isLoading?: boolean;
  customerSearch: string;
  onCustomerSearchChange: (value: string) => void;
  customers: CustomerOption[];
  onSelectCustomer: (customer: CustomerOption | null) => void;
  productSearch: string;
  onProductSearchChange: (value: string) => void;
  products: ProductListItem[];
  isLoadingProducts: boolean;
  hasMoreProducts: boolean;
  onLoadMoreProducts: () => void;
  isFetchingMoreProducts: boolean;
  onIncrementProduct: (productId: string) => void;
  onDecrementProduct: (productId: string) => void;
  totalAmount: number;
}

const OrderFormContent = ({
  title,
  submitLabel,
  form,
  setForm,
  onSubmit,
  onClose,
  error,
  isSubmitting,
  isLoading,
  customerSearch,
  onCustomerSearchChange,
  customers,
  onSelectCustomer,
  productSearch,
  onProductSearchChange,
  products,
  isLoadingProducts,
  hasMoreProducts,
  onLoadMoreProducts,
  isFetchingMoreProducts,
  onIncrementProduct,
  onDecrementProduct,
  totalAmount,
}: OrderFormContentProps) => {
  const totalFormatted = formatCurrency(totalAmount);
  const orderRentalDays = useMemo(
    () => calculateRentalDays(form.installation_date, form.dismantle_date),
    [form.installation_date, form.dismantle_date]
  );
  const totalLabel = orderRentalDays === null ? '—' : totalFormatted;

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMoreProducts) {
      return;
    }
    const element = loadMoreRef.current;
    if (!element) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingMoreProducts) {
        onLoadMoreProducts();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMoreProducts, onLoadMoreProducts, isFetchingMoreProducts]);

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as OrderStatus;
    setForm((prev) => ({ ...prev, status: value }));
  };

  const handleInstallationDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, installation_date: value }));
  };

  const handleDismantleDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, dismantle_date: value }));
  };

  const handleDeliveryTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as DeliveryType;
    setForm((prev) => ({
      ...prev,
      delivery_type: value,
      delivery_address: value === 'pickup' ? '' : prev.delivery_address,
    }));
  };

  const handleDeliveryAddressChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, delivery_address: value }));
  };

  const handleCommentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, comment: value }));
  };

  const content: ReactNode = isLoading ? (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 240,
      }}
    >
      <Spinner />
    </div>
  ) : (
    <form
      onSubmit={onSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>{title}</h2>
        <Button type="button" variant="ghost" onClick={onClose}>
          Закрыть
        </Button>
      </header>

      {error ? (
        <Alert tone="danger" title="Не удалось сохранить заказ">
          {error}
        </Alert>
      ) : null}

      <div
        style={{
          display: 'grid',
          gap: '16px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}
      >
        <Select label="Статус" value={form.status} onChange={handleStatusChange}>
          {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          label="Дата монтажа"
          value={form.installation_date}
          onChange={handleInstallationDateChange}
          required
        />
        <Input
          type="date"
          label="Дата демонтажа"
          value={form.dismantle_date}
          onChange={handleDismantleDateChange}
          required
        />
        <Select label="Тип доставки" value={form.delivery_type} onChange={handleDeliveryTypeChange}>
          <option value="delivery">Доставка</option>
          <option value="pickup">Самовывоз</option>
        </Select>
        {form.delivery_type === 'delivery' ? (
          <Input
            label="Адрес доставки"
            placeholder="Город, улица, дом"
            value={form.delivery_address}
            onChange={handleDeliveryAddressChange}
            required
          />
        ) : null}
      </div>

      <Accordion
        title={form.customer ? `Клиент: ${form.customer.display_name}` : 'Выбор клиента'}
        actions={
          form.customer ? (
            <Button type="button" variant="ghost" onClick={() => onSelectCustomer(null)}>
              Очистить
            </Button>
          ) : undefined
        }
      >
        <Input
          placeholder="Поиск клиента"
          value={customerSearch}
          onChange={(event) => onCustomerSearchChange(event.target.value)}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: 240,
            overflow: 'auto',
          }}
        >
          {customers.length ? (
            customers.map((customer) => {
              const isSelected = customer.id === form.customer?.id;
              return (
                <Button
                  key={customer.id}
                  type="button"
                  variant={isSelected ? 'primary' : 'ghost'}
                  onClick={() => onSelectCustomer(customer)}
                >
                  {customer.display_name || 'Без имени'}
                </Button>
              );
            })
          ) : (
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              Клиенты не найдены.
            </span>
          )}
        </div>
      </Accordion>

      <Accordion
        title="Товары"
        actions={
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            {totalLabel}
          </span>
        }
      >
        <Input
          placeholder="Поиск товара"
          value={productSearch}
          onChange={(event) => onProductSearchChange(event.target.value)}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 120 }}>
          {isLoadingProducts ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
              <Spinner />
            </div>
          ) : products.length ? (
            products.map((product) => {
              const quantity = form.productQuantities[product.id] ?? 0;
              const canShowTotals = orderRentalDays !== null;
              const unitTotal = canShowTotals
                ? calculateRentalTotal(
                    product.price_rub,
                    product.rental?.mode ?? 'standard',
                    product.rental?.tiers,
                    orderRentalDays
                  )
                : 0;
              const lineTotal = canShowTotals ? unitTotal * quantity : 0;
              return (
                <div
                  key={product.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '10px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <strong style={{ fontSize: '1rem' }}>{product.name}</strong>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        {formatCurrency(product.price_rub)} за первый день
                      </span>
                    </div>
                    {quantity > 0 ? (
                      canShowTotals ? (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '12px',
                            alignItems: 'flex-end',
                          }}
                        >
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                            Дней аренды: {orderRentalDays}
                          </span>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                            Итог за единицу: {formatCurrency(unitTotal)}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            Сумма: {formatCurrency(lineTotal)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                          Укажите даты монтажа и демонтажа, чтобы рассчитать стоимость.
                        </span>
                      )
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onDecrementProduct(product.id)}
                      disabled={quantity === 0}
                    >
                      −
                    </Button>
                    <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>
                      {quantity}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onIncrementProduct(product.id)}
                    >
                      +
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              Товары не найдены.
            </span>
          )}
          <div ref={loadMoreRef} />
          {isFetchingMoreProducts ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
              <Spinner />
            </div>
          ) : null}
        </div>
      </Accordion>

      <FormField label="Комментарий">
        <textarea
          value={form.comment}
          onChange={handleCommentChange}
          placeholder="Дополнительные пожелания"
          style={{
            width: '100%',
            minHeight: 96,
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid var(--color-border)',
            font: 'inherit',
            resize: 'vertical',
          }}
        />
      </FormField>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Сумма заказа
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{totalLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Отмена
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );

  return content;
};

export default function OrdersPage() {
  const canManageOrders = usePermission('orders_change_order');

  const [statusGroup, setStatusGroup] = useState<OrderStatusGroup>('current');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editOrderId, setEditOrderId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState<OrderFormState>(() => createInitialFormState());
  const [editForm, setEditForm] = useState<OrderFormState>(() => createInitialFormState());
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const productQueryParams = useMemo(
    () => ({
      limit: 12,
      q: productSearch.trim() || undefined,
      include: 'rental',
    }),
    [productSearch]
  );

  const {
    data: productPages,
    fetchNextPage: fetchNextProducts,
    hasNextPage: hasMoreProducts = false,
    isFetchingNextPage: isFetchingMoreProducts,
    isLoading: isLoadingProducts,
  } = useInfiniteProductsQuery(productQueryParams);

  const fetchedProducts: ProductListItem[] = useMemo(
    () => productPages?.pages.flatMap((page) => page.results) ?? [],
    [productPages]
  );
  const { data: editOrderResponse, isLoading: isEditLoading } = useOrderQuery(
    editOrderId ?? '',
    Boolean(isEditOpen && editOrderId !== null)
  );
  const products: ProductListItem[] = useMemo(() => {
    if (!editOrderResponse?.data) {
      return fetchedProducts;
    }
    const existingIds = new Set(fetchedProducts.map((product) => product.id));
    const extras: ProductListItem[] = [];
    editOrderResponse.data.items.forEach((item) => {
      if (item.product?.id && !existingIds.has(item.product.id)) {
        extras.push({
          id: item.product.id,
          name: item.product.name,
          price_rub: Number(item.unit_price),
          color: coerceProductColor(item.product.color),
          thumbnail_url: item.product.thumbnail_url ?? null,
          delivery: { transport_restriction: null, self_pickup_allowed: false },
          rental: {
            mode: item.rental_mode,
            tiers: item.rental_tiers ?? undefined,
          },
        });
      }
    });
    return extras.length ? [...extras, ...fetchedProducts] : fetchedProducts;
  }, [fetchedProducts, editOrderResponse]);

  const productsMap = useMemo(() => {
    const map: Record<string, ProductListItem> = {};
    products.forEach((product) => {
      map[product.id] = product;
    });
    return map;
  }, [products]);

  const loadMoreProducts = useCallback(() => {
    if (hasMoreProducts) {
      void fetchNextProducts();
    }
  }, [fetchNextProducts, hasMoreProducts]);

  const calculateTotal = useCallback(
    (form: OrderFormState, map?: Record<string, ProductListItem>) => {
      const source = map ?? productsMap;
      const rentalDays = calculateRentalDays(form.installation_date, form.dismantle_date);
      if (!rentalDays) {
        return 0;
      }
      return Object.entries(form.productQuantities).reduce((sum, [productId, quantity]) => {
        const product = source[productId];
        if (!product || quantity <= 0) {
          return sum;
        }
        const unitTotal = calculateRentalTotal(
          product.price_rub,
          product.rental?.mode ?? 'standard',
          product.rental?.tiers,
          rentalDays
        );
        return sum + unitTotal * quantity;
      }, 0);
    },
    [productsMap]
  );

  const buildPayloadFromForm = useCallback(
    (form: OrderFormState): CreateOrderPayload => {
      const rentalDays = calculateRentalDays(form.installation_date, form.dismantle_date) ?? 1;
      return {
        status: form.status,
        installation_date: form.installation_date,
        dismantle_date: form.dismantle_date,
        customer_id: form.customer?.id ?? null,
        delivery_type: form.delivery_type,
        delivery_address:
          form.delivery_type === 'pickup' ? null : form.delivery_address.trim() || null,
        comment: form.comment.trim() || null,
        items: Object.entries(form.productQuantities)
          .filter(([, quantity]) => quantity > 0)
          .map(([productId, quantity]) => {
            const product = productsMap[productId];
            const item: OrderItemPayload = {
              product_id: productId,
              quantity,
              rental_days: rentalDays,
            };
            if (product?.rental?.mode) {
              item.rental_mode = product.rental.mode;
              if (product.rental.mode === 'special' && product.rental.tiers?.length) {
                item.rental_tiers = product.rental.tiers;
              }
            }
            return item;
          }),
      };
    },
    [productsMap]
  );

  const editProductsMap = useMemo(() => {
    if (!editOrderResponse?.data) {
      return productsMap;
    }
    const map: Record<string, ProductListItem> = { ...productsMap };
    editOrderResponse.data.items.forEach((item) => {
      if (item.product?.id && !map[item.product.id]) {
        map[item.product.id] = {
          id: item.product.id,
          name: item.product.name,
          price_rub: Number(item.unit_price),
          color: coerceProductColor(item.product.color),
          thumbnail_url: item.product.thumbnail_url ?? null,
          delivery: { transport_restriction: null, self_pickup_allowed: false },
          rental: {
            mode: item.rental_mode,
            tiers: item.rental_tiers ?? undefined,
          },
        };
      }
    });
    return map;
  }, [productsMap, editOrderResponse]);

  const queryParams = useMemo(
    () => ({
      status_group: statusGroup,
      search: searchTerm || undefined,
    }),
    [statusGroup, searchTerm]
  );

  const {
    data: ordersResponse,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useOrdersQuery(queryParams);

  const orders: OrderSummary[] = ordersResponse?.data ?? [];

  const customersQuery = useCustomersQuery(
    useMemo(
      () => ({
        search: customerSearch || undefined,
        page: 1,
        page_size: 20,
      }),
      [customerSearch]
    )
  );

  const customerOptions = customersQuery.data?.data ?? [];

  const createMutation = useCreateOrderMutation();
  const updateMutation = useUpdateOrderMutation();

  useEffect(() => {
    if (isEditOpen && editOrderResponse?.data) {
      const order = editOrderResponse.data;
      const quantities: Record<string, number> = {};
      order.items.forEach((item) => {
        if (item.product?.id) {
          quantities[item.product.id] = item.quantity;
        }
      });
      setEditForm({
        status: order.status,
        installation_date: order.installation_date,
        dismantle_date: order.dismantle_date,
        customer: order.customer,
        delivery_type: order.delivery_type,
        delivery_address: order.delivery_address ?? '',
        comment: order.comment ?? '',
        productQuantities: quantities,
      });
      setCustomerSearch(order.customer?.display_name ?? '');
      setProductSearch('');
    }
  }, [editOrderResponse, isEditOpen]);

  useEffect(() => {
    const normalizedInput = searchInput.trim();

    if (normalizedInput === searchTerm) {
      return;
    }

    setSearchTerm(normalizedInput);
  }, [searchInput, searchTerm]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const handleResetSearch = () => {
    setSearchInput('');
    setSearchTerm('');
  };

  const handleOpenCreate = () => {
    if (!canManageOrders) {
      return;
    }
    setCreateForm(createInitialFormState());
    setCustomerSearch('');
    setProductSearch('');
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const closeCreateDrawer = () => {
    if (createMutation.isPending) {
      return;
    }
    setIsCreateOpen(false);
  };

  const handleOpenEdit = useCallback(
    (orderId: number) => {
      if (!canManageOrders) {
        return;
      }
      setEditOrderId(orderId);
      setEditError(null);
      setCustomerSearch('');
      setProductSearch('');
      setIsEditOpen(true);
    },
    [canManageOrders]
  );

  const closeEditDrawer = () => {
    if (updateMutation.isPending) {
      return;
    }
    setIsEditOpen(false);
    setEditOrderId(null);
  };

  const ensurePayloadValid = (form: OrderFormState): string | null => {
    if (!form.installation_date || !form.dismantle_date) {
      return 'Укажите даты монтажа и демонтажа.';
    }
    const rentalDays = calculateRentalDays(form.installation_date, form.dismantle_date);
    if (!rentalDays) {
      return 'Дата демонтажа должна быть не раньше даты монтажа.';
    }
    if (form.delivery_type === 'delivery' && !form.delivery_address.trim()) {
      return 'Введите адрес доставки или выберите самовывоз.';
    }
    const hasItems = Object.values(form.productQuantities).some((quantity) => quantity > 0);
    if (!hasItems) {
      return 'Добавьте хотя бы один товар в заказ.';
    }
    return null;
  };

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageOrders) {
      return;
    }
    const validationError = ensurePayloadValid(createForm);
    if (validationError) {
      setCreateError(validationError);
      return;
    }
    setCreateError(null);
    const payload = buildPayloadFromForm(createForm);
    createMutation.mutate(payload, {
      onSuccess: () => {
        setIsCreateOpen(false);
        setCreateForm(createInitialFormState());
        setSuccessMessage('Заказ успешно создан. Список обновлён.');
        void refetch();
      },
      onError: (mutationError) => {
        setCreateError(
          mutationError instanceof Error
            ? mutationError.message
            : 'Не удалось создать заказ. Попробуйте снова.'
        );
      },
    });
  };

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageOrders || editOrderId === null) {
      return;
    }
    const validationError = ensurePayloadValid(editForm);
    if (validationError) {
      setEditError(validationError);
      return;
    }
    setEditError(null);
    const payload = buildPayloadFromForm(editForm);
    updateMutation.mutate(
      { orderId: editOrderId, payload },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setEditOrderId(null);
          setSuccessMessage('Изменения сохранены.');
          void refetch();
        },
        onError: (mutationError) => {
          setEditError(
            mutationError instanceof Error
              ? mutationError.message
              : 'Не удалось обновить заказ. Попробуйте снова.'
          );
        },
      }
    );
  };

  const updateProductQuantity = useCallback(
    (setter: OrderFormSetter, productId: string, delta: number) => {
      setter((prev) => {
        const current = prev.productQuantities[productId] ?? 0;
        const next = Math.max(0, current + delta);
        return {
          ...prev,
          productQuantities: {
            ...prev.productQuantities,
            [productId]: next,
          },
        };
      });
    },
    []
  );

  const handleCreateIncrement = (productId: string) =>
    updateProductQuantity(setCreateForm, productId, 1);
  const handleCreateDecrement = (productId: string) =>
    updateProductQuantity(setCreateForm, productId, -1);
  const handleEditIncrement = (productId: string) =>
    updateProductQuantity(setEditForm, productId, 1);
  const handleEditDecrement = (productId: string) =>
    updateProductQuantity(setEditForm, productId, -1);

  const handleSelectCreateCustomer = (customer: CustomerOption | null) => {
    setCreateForm((prev) => ({ ...prev, customer }));
  };
  const handleSelectEditCustomer = (customer: CustomerOption | null) => {
    setEditForm((prev) => ({ ...prev, customer }));
  };

  const columns: TableColumn<OrderSummary>[] = useMemo(
    () => [
      { key: 'id', header: '№ заказа' },
      {
        key: 'status',
        header: 'Статус',
        render: (row) => <Tag tone={STATUS_TAG_TONES[row.status]}>{row.status_label}</Tag>,
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
        key: 'customer',
        header: 'Клиент',
        render: (row) => row.customer?.display_name ?? '—',
      },
      {
        key: 'delivery_address',
        header: 'Доставка',
        render: (row) =>
          row.delivery_type === 'pickup' ? 'Самовывоз' : row.delivery_address || 'Адрес не указан',
      },
      {
        key: 'comment',
        header: 'Комментарий',
        render: (row) => row.comment || '—',
      },
      {
        key: 'actions',
        header: 'Действия',
        render: (row) => (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Link href={`/orders/${row.id}`}>
              <Button variant="ghost" type="button">
                Подробнее
              </Button>
            </Link>
            {canManageOrders ? (
              <Button variant="ghost" type="button" onClick={() => handleOpenEdit(row.id)}>
                Редактировать
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [canManageOrders, handleOpenEdit]
  );

  return (
    <RoleGuard allow={['adminpanel_view_orders', 'orders_view_order']}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 600 }}>Заказы</h1>
            <p style={{ color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
              Управляйте текущими заказами, архивом и отменёнными заявками.
            </p>
          </div>
          {canManageOrders ? (
            <Button type="button" onClick={handleOpenCreate}>
              Новый заказ
            </Button>
          ) : null}
        </header>

        {successMessage ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Alert tone="success" title="Готово">
              {successMessage}
            </Alert>
            <Button type="button" variant="ghost" onClick={() => setSuccessMessage(null)}>
              Скрыть
            </Button>
          </div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '12px',
            width: '100%',
          }}
        >
          {STATUS_GROUP_TABS.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant={tab.id === statusGroup ? 'primary' : 'ghost'}
              onClick={() => setStatusGroup(tab.id)}
              style={{ width: '100%' }}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: '12px',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Input
            placeholder="Поиск по адресу или комментарию"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            style={{ width: '100%' }}
          />
          <Button type="submit">Найти</Button>
          <Button type="button" variant="ghost" onClick={handleResetSearch}>
            Сбросить
          </Button>
        </form>

        {isError ? (
          <Alert tone="danger" title="Не удалось загрузить заказы">
            {error instanceof Error ? error.message : 'Попробуйте обновить страницу чуть позже.'}
          </Alert>
        ) : null}

        <div style={{ position: 'relative' }}>
          {isFetching && !isLoading ? (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255,255,255,0.8)',
                borderRadius: '12px',
              }}
            >
              <Spinner />
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Обновление…
              </span>
            </div>
          ) : null}
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 320,
              }}
            >
              <Spinner />
            </div>
          ) : (
            <Table<OrderSummary>
              columns={columns}
              data={orders}
              emptyMessage="Заказы не найдены. Попробуйте изменить фильтры."
            />
          )}
        </div>

        <Drawer open={isCreateOpen} onClose={closeCreateDrawer}>
          <OrderFormContent
            title="Создание заказа"
            submitLabel={createMutation.isPending ? 'Создание…' : 'Создать заказ'}
            form={createForm}
            setForm={setCreateForm}
            onSubmit={handleCreateSubmit}
            onClose={closeCreateDrawer}
            error={createError}
            isSubmitting={createMutation.isPending}
            customerSearch={customerSearch}
            onCustomerSearchChange={setCustomerSearch}
            customers={customerOptions}
            onSelectCustomer={handleSelectCreateCustomer}
            productSearch={productSearch}
            onProductSearchChange={setProductSearch}
            products={products}
            isLoadingProducts={isLoadingProducts}
            hasMoreProducts={hasMoreProducts}
            onLoadMoreProducts={loadMoreProducts}
            isFetchingMoreProducts={isFetchingMoreProducts}
            onIncrementProduct={handleCreateIncrement}
            onDecrementProduct={handleCreateDecrement}
            totalAmount={calculateTotal(createForm)}
          />
        </Drawer>

        <Drawer open={isEditOpen} onClose={closeEditDrawer}>
          <OrderFormContent
            title="Редактирование заказа"
            submitLabel={updateMutation.isPending ? 'Сохранение…' : 'Сохранить изменения'}
            form={editForm}
            setForm={setEditForm}
            onSubmit={handleEditSubmit}
            onClose={closeEditDrawer}
            error={editError}
            isSubmitting={updateMutation.isPending}
            isLoading={isEditLoading && !editOrderResponse}
            customerSearch={customerSearch}
            onCustomerSearchChange={setCustomerSearch}
            customers={customerOptions}
            onSelectCustomer={handleSelectEditCustomer}
            productSearch={productSearch}
            onProductSearchChange={setProductSearch}
            products={products}
            isLoadingProducts={isLoadingProducts}
            hasMoreProducts={hasMoreProducts}
            onLoadMoreProducts={loadMoreProducts}
            isFetchingMoreProducts={isFetchingMoreProducts}
            onIncrementProduct={handleEditIncrement}
            onDecrementProduct={handleEditDecrement}
            totalAmount={calculateTotal(editForm, editProductsMap)}
          />
        </Drawer>
      </div>
    </RoleGuard>
  );
}

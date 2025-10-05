import { http, HttpResponse } from 'msw';
import productsFixture from './fixtures/products.json';
import ordersFixture from './fixtures/orders.json';
import customersFixture from './fixtures/customers.json';
import inventoryItemsFixture from './fixtures/inventory-items.json';
import documentsFixture from './fixtures/documents.json';

interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

interface MediaAsset {
  id: string;
  type: string;
  url: string;
  alt_text: string;
  is_primary: boolean;
  sort_order?: number;
}

interface AttributeValue {
  attribute_id: string;
  code: string;
  name: string;
  value: string;
  unit: string | null;
}

interface Product {
  id: string;
  category: CategorySummary;
  sku: string;
  name: string;
  slug: string;
  status: string;
  availability_status: string;
  rental_unit: string;
  base_price: number;
  security_deposit: number | null;
  short_description: string;
  full_description: string;
  media: MediaAsset[];
  attributes: AttributeValue[];
  created_at: string;
  updated_at: string;
}

interface OrderTotals {
  rental_total: number;
  delivery_total: number;
  deposit_total: number;
  discount_total: number;
  grand_total: number;
}

interface OrderItem {
  id: string;
  product_id: string | null;
  bundle_id: string | null;
  name: string;
  quantity: number;
  rental_days: number;
  unit_price: number;
  deposit_amount: number;
  discount_amount: number;
  status: string;
}

interface Payment {
  id: string;
  purpose: string;
  provider: string;
  method: string;
  amount: number;
  currency: string;
  status: string;
  due_at: string | null;
  paid_at: string | null;
  external_reference: string | null;
}

interface Deposit {
  id: string;
  expected_amount: number;
  captured_amount: number | null;
  status: string;
  captured_at: string | null;
  released_at: string | null;
  notes: string | null;
}

interface CustomerSummary {
  id: string;
  display_name: string;
  email: string;
}

interface CompanySummary {
  id: string;
  legal_name: string;
  trade_name: string;
}

interface CustomerCompany extends CompanySummary {
  tax_id?: string;
  payment_terms?: string;
  website?: string | null;
}

interface Address {
  id: string;
  label: string;
  country: string;
  region: string;
  city: string;
  street: string;
  building: string;
  postal_code: string;
  is_primary: boolean;
}

interface Contact {
  id: string;
  type: string;
  value: string;
  notes: string | null;
}

interface Customer {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  company: CustomerCompany | null;
  addresses: Address[];
  contacts: Contact[];
  created_at: string;
  updated_at?: string;
}

interface Order {
  id: string;
  code: string;
  customer: CustomerSummary;
  company: CompanySummary | null;
  status: string;
  payment_status: string;
  channel: string;
  rental_start_date: string;
  rental_end_date: string;
  totals: OrderTotals;
  items: OrderItem[];
  payments: Payment[];
  deposit: Deposit;
  created_at: string;
  updated_at: string;
}

interface Reservation {
  id: string;
  order_id: string;
  reserved_from: string;
  reserved_to: string;
  quantity: number;
  status: string;
}

interface InventoryItem {
  id: string;
  product_id: string;
  warehouse_id: string;
  condition: string;
  serial_number: string | null;
  quantity_total: number;
  quantity_available: number;
  quantity_reserved: number;
  status: string;
  reservations: Reservation[];
  updated_at?: string;
}

interface Document {
  id: string;
  order_id: string;
  type: string;
  status: string;
  file_url: string;
  version: number;
  issued_at: string | null;
  valid_until: string | null;
}

type SortSelector<T> = (item: T) => string | number | null;

type PaginationMeta = {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
};

type PaginationLinks = {
  self: string;
  next: string | null;
  prev: string | null;
  first: string;
  last: string;
};

type PaginatedPayload<T> = {
  data: T[];
  meta: { pagination: PaginationMeta };
  links: PaginationLinks;
};

type ErrorPayload = {
  errors: Array<{
    code: string;
    title: string;
    detail?: string;
    source?: {
      pointer?: string;
      parameter?: string;
    };
  }>;
  trace_id: string;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const toTraceId = () => `mock-trace-${Math.random().toString(16).slice(2, 10)}`;

const products = clone(productsFixture) as Product[];
const orders = clone(ordersFixture) as Order[];
const customers = clone(customersFixture) as Customer[];
const inventoryItems = clone(inventoryItemsFixture) as InventoryItem[];
const documents = clone(documentsFixture) as Document[];

const findCustomerCompany = (companyId: string | null | undefined): CustomerCompany | null => {
  if (!companyId) {
    return null;
  }
  return customers.map((item) => item.company).find((company) => company && company.id === companyId) ?? null;
};

const findCompanySummary = (companyId: string | null | undefined): CompanySummary | null =>
  toCompanySummary(findCustomerCompany(companyId));

const categoryMap = new Map(products.map((product) => [product.category.id, clone(product.category)]));
const attributeMap = new Map(
  products.flatMap((product) =>
    product.attributes.map((attribute) => [attribute.attribute_id, { code: attribute.code, name: attribute.name, unit: attribute.unit }])
  )
);

const createErrorResponse = (status: number, error: ErrorPayload['errors'][number]) =>
  HttpResponse.json<ErrorPayload>(
    {
      errors: [error],
      trace_id: toTraceId(),
    },
    { status }
  );

const parsePagination = (url: URL) => {
  const page = Number(url.searchParams.get('page') ?? '1');
  const pageSize = Number(url.searchParams.get('page_size') ?? '20');
  return {
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
    pageSize: Number.isFinite(pageSize) && pageSize >= 1 && pageSize <= 100 ? Math.floor(pageSize) : 20,
  };
};

const getFilterValues = (url: URL, filterName: string): string[] => {
  const values: string[] = [];
  url.searchParams.forEach((value, paramKey) => {
    const matches = paramKey.match(/^filter\[(.+)]$/);
    if (matches && matches[1] === filterName) {
      values.push(value);
    }
  });
  return values;
};

const applySearch = <T>(items: T[], searchTerm: string | null, selector: (item: T) => string[]): T[] => {
  if (!searchTerm) {
    return items;
  }
  const lowered = searchTerm.toLowerCase();
  return items.filter((item) => selector(item).some((value) => value.toLowerCase().includes(lowered)));
};

const applySort = <T>(items: T[], sortRaw: string | null, selectors: Record<string, SortSelector<T>>): T[] => {
  if (!sortRaw) {
    return [...items];
  }
  const tokens = sortRaw
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => ({
      key: token.startsWith('-') ? token.slice(1) : token,
      direction: token.startsWith('-') ? -1 : 1,
    }));

  for (const token of tokens) {
    if (!selectors[token.key]) {
      throw createErrorResponse(400, {
        code: 'invalid_sort',
        title: 'Поле сортировки не поддерживается',
        detail: `Поле "${token.key}" не поддерживает сортировку`,
        source: { parameter: 'sort' },
      });
    }
  }

  return [...items].sort((a, b) => {
    for (const token of tokens) {
      const selector = selectors[token.key]!;
      const valueA = selector(a);
      const valueB = selector(b);
      if (valueA === valueB) {
        continue;
      }
      if (valueA === null || valueA === undefined) {
        return 1;
      }
      if (valueB === null || valueB === undefined) {
        return -1;
      }
      if (valueA < valueB) {
        return -1 * token.direction;
      }
      if (valueA > valueB) {
        return 1 * token.direction;
      }
    }
    return 0;
  });
};

const buildPagination = <T>(url: URL, dataset: T[], page: number, pageSize: number): PaginatedPayload<T> => {
  const total = dataset.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = dataset.slice(start, end);

  const hasNext = totalPages > 0 && safePage < totalPages;
  const hasPrev = totalPages > 0 && safePage > 1;

  const buildLink = (targetPage: number | null) => {
    if (!targetPage) {
      return null;
    }
    const params = new URLSearchParams(url.searchParams);
    params.set('page', String(targetPage));
    params.set('page_size', String(pageSize));
    return `${url.origin}${url.pathname}?${params.toString()}`;
  };

  const firstLink = buildLink(1)!;
  const lastLink = totalPages === 0 ? buildLink(1)! : buildLink(totalPages)!;

  return {
    data: pageItems,
    meta: {
      pagination: {
        page: safePage,
        page_size: pageSize,
        total_items: total,
        total_pages: totalPages,
        has_next: hasNext,
        has_prev: hasPrev,
      },
    },
    links: {
      self: buildLink(safePage)!,
      next: hasNext ? buildLink(safePage + 1) : null,
      prev: hasPrev ? buildLink(safePage - 1) : null,
      first: firstLink,
      last: lastLink,
    },
  };
};

const selectProducts = (url: URL): PaginatedPayload<Product> | Response => {
  const { page, pageSize } = parsePagination(url);
  const searchTerm = url.searchParams.get('search');
  const statusFilter = getFilterValues(url, 'status');
  const categoryFilter = getFilterValues(url, 'category_id');
  const sortValue = url.searchParams.get('sort');

  let subset = applySearch(products, searchTerm, (product) => [product.name, product.sku, product.category.name]);

  if (statusFilter.length > 0) {
    const allowed = new Set(statusFilter);
    subset = subset.filter((product) => allowed.has(product.status));
  }

  if (categoryFilter.length > 0) {
    const allowed = new Set(categoryFilter);
    subset = subset.filter((product) => allowed.has(product.category.id));
  }

  try {
    const sorted = applySort(subset, sortValue, {
      name: (product) => product.name.toLowerCase(),
      base_price: (product) => product.base_price,
      created_at: (product) => new Date(product.created_at).getTime(),
    });

    return buildPagination(url, sorted, page, pageSize);
  } catch (error) {
    if (error instanceof Response) {
      return error as Response;
    }
    throw error;
  }
};

const selectOrders = (url: URL): PaginatedPayload<Order> | Response => {
  const { page, pageSize } = parsePagination(url);
  const searchTerm = url.searchParams.get('search');
  const statusFilter = getFilterValues(url, 'status');
  const customerFilter = getFilterValues(url, 'customer_id');
  const sortValue = url.searchParams.get('sort');

  let subset = applySearch(orders, searchTerm, (order) => [order.code, order.customer.display_name, order.customer.email]);

  if (statusFilter.length > 0) {
    const allowed = new Set(statusFilter);
    subset = subset.filter((order) => allowed.has(order.status));
  }

  if (customerFilter.length > 0) {
    const allowed = new Set(customerFilter);
    subset = subset.filter((order) => allowed.has(order.customer.id));
  }

  try {
    const sorted = applySort(subset, sortValue, {
      code: (order) => order.code,
      created_at: (order) => new Date(order.created_at).getTime(),
      rental_start_date: (order) => new Date(order.rental_start_date).getTime(),
    });

    return buildPagination(url, sorted, page, pageSize);
  } catch (error) {
    if (error instanceof Response) {
      return error as Response;
    }
    throw error;
  }
};

const selectCustomers = (url: URL): PaginatedPayload<Customer> | Response => {
  const { page, pageSize } = parsePagination(url);
  const searchTerm = url.searchParams.get('search');
  const roleFilter = getFilterValues(url, 'role');
  const sortValue = url.searchParams.get('sort');

  let subset = applySearch(customers, searchTerm, (customer) => [customer.email, customer.first_name, customer.last_name]);

  if (roleFilter.length > 0) {
    const allowed = new Set(roleFilter);
    subset = subset.filter((customer) => allowed.has(customer.role));
  }

  try {
    const sorted = applySort(subset, sortValue, {
      created_at: (customer) => new Date(customer.created_at).getTime(),
      last_name: (customer) => customer.last_name.toLowerCase(),
    });

    return buildPagination(url, sorted, page, pageSize);
  } catch (error) {
    if (error instanceof Response) {
      return error as Response;
    }
    throw error;
  }
};

const selectInventory = (url: URL): PaginatedPayload<InventoryItem> | Response => {
  const { page, pageSize } = parsePagination(url);
  const searchTerm = url.searchParams.get('search');
  const productFilter = getFilterValues(url, 'product_id');
  const sortValue = url.searchParams.get('sort');

  let subset = applySearch(inventoryItems, searchTerm, (item) => [item.warehouse_id, item.product_id]);

  if (productFilter.length > 0) {
    const allowed = new Set(productFilter);
    subset = subset.filter((item) => allowed.has(item.product_id));
  }

  try {
    const sorted = applySort(subset, sortValue, {
      quantity_available: (item) => item.quantity_available,
      status: (item) => item.status,
    });

    return buildPagination(url, sorted, page, pageSize);
  } catch (error) {
    if (error instanceof Response) {
      return error as Response;
    }
    throw error;
  }
};

const selectDocuments = (url: URL): PaginatedPayload<Document> | Response => {
  const { page, pageSize } = parsePagination(url);
  const searchTerm = url.searchParams.get('search');
  const typeFilter = getFilterValues(url, 'type');
  const sortValue = url.searchParams.get('sort');

  let subset = applySearch(documents, searchTerm, (document) => [document.type, document.order_id]);

  if (typeFilter.length > 0) {
    const allowed = new Set(typeFilter);
    subset = subset.filter((document) => allowed.has(document.type));
  }

  try {
    const sorted = applySort(subset, sortValue, {
      issued_at: (document) => (document.issued_at ? new Date(document.issued_at).getTime() : 0),
      type: (document) => document.type,
    });

    return buildPagination(url, sorted, page, pageSize);
  } catch (error) {
    if (error instanceof Response) {
      return error as Response;
    }
    throw error;
  }
};

const toCompanySummary = (company: CustomerCompany | null | undefined): CompanySummary | null =>
  company
    ? { id: company.id, legal_name: company.legal_name, trade_name: company.trade_name }
    : null;

const resolveCategory = (categoryId: string) => {
  if (!categoryMap.has(categoryId)) {
    categoryMap.set(categoryId, {
      id: categoryId,
      name: 'Неизвестная категория',
      slug: `category-${categoryId.slice(0, 8)}`,
    });
  }
  return categoryMap.get(categoryId)!;
};

const resolveAttributes = (
  attributeValues: Array<{ attribute_id: string; value: string }>
): Product['attributes'] =>
  attributeValues.map((item) => {
    const meta = attributeMap.get(item.attribute_id);
    if (!meta) {
      attributeMap.set(item.attribute_id, {
        code: `attr_${item.attribute_id.slice(0, 6)}`,
        name: `Атрибут ${item.attribute_id.slice(0, 4)}`,
        unit: null,
      });
    }
    const resolved = attributeMap.get(item.attribute_id)!;
    return {
      attribute_id: item.attribute_id,
      code: resolved.code,
      name: resolved.name,
      value: item.value,
      unit: resolved.unit ?? null,
    };
  });

const updateTimestamps = <T extends { created_at?: string; updated_at?: string }>(entity: T, isNew: boolean) => {
  const now = new Date().toISOString();
  if (isNew && !entity.created_at) {
    Object.assign(entity, { created_at: now });
  }
  Object.assign(entity, { updated_at: now });
};

export const handlers = [
  http.get('/api/products', ({ request }) => {
    const url = new URL(request.url);
    const payload = selectProducts(url);
    if (payload instanceof Response) {
      return payload;
    }
    return HttpResponse.json(payload);
  }),
  http.get('/api/products/:productId', ({ params }) => {
    const product = products.find((item) => item.id === params.productId);
    if (!product) {
      return createErrorResponse(404, {
        code: 'not_found',
        title: 'Продукт не найден',
        detail: `Продукт ${params.productId} отсутствует в каталоге`,
      });
    }
    return HttpResponse.json({ data: product });
  }),
  http.post('/api/products', async ({ request }) => {
    const body = (await request.json()) as {
      category_id: string;
      sku: string;
      name: string;
      slug?: string;
      status: Product['status'];
      availability_status: Product['availability_status'];
      rental_unit: Product['rental_unit'];
      base_price: number;
      security_deposit?: number | null;
      short_description: string;
      full_description?: string;
      attribute_values?: Array<{ attribute_id: string; value: string }>;
    };

    if (!body.name || !body.sku) {
      return createErrorResponse(400, {
        code: 'validation_error',
        title: 'Некорректные данные продукта',
        detail: 'Поля name и sku обязательны',
        source: { pointer: '/name' },
      });
    }

    const now = new Date().toISOString();
    const newProduct: Product = {
      id: generateId(),
      category: resolveCategory(body.category_id),
      sku: body.sku,
      name: body.name,
      slug: body.slug ?? body.name.toLowerCase().replace(/\s+/g, '-'),
      status: body.status,
      availability_status: body.availability_status,
      rental_unit: body.rental_unit,
      base_price: body.base_price,
      security_deposit: body.security_deposit ?? null,
      short_description: body.short_description,
      full_description: body.full_description ?? body.short_description,
      media: [],
      attributes: resolveAttributes(body.attribute_values ?? []),
      created_at: now,
      updated_at: now,
    };

    products.unshift(newProduct);

    return HttpResponse.json({ data: newProduct }, { status: 201 });
  }),
  http.patch('/api/products/:productId', async ({ request, params }) => {
    const product = products.find((item) => item.id === params.productId);
    if (!product) {
      return createErrorResponse(404, {
        code: 'not_found',
        title: 'Продукт не найден',
      });
    }

    const body = (await request.json()) as Partial<{
      category_id: string;
      name: string;
      status: Product['status'];
      availability_status: Product['availability_status'];
      rental_unit: Product['rental_unit'];
      base_price: number;
      security_deposit: number | null;
      short_description: string;
      full_description: string;
      attribute_values: Array<{ attribute_id: string; value: string }>;
    }>;

    if (body.category_id) {
      product.category = resolveCategory(body.category_id);
    }
    if (body.name) {
      product.name = body.name;
    }
    if (body.status) {
      product.status = body.status;
    }
    if (body.availability_status) {
      product.availability_status = body.availability_status;
    }
    if (body.rental_unit) {
      product.rental_unit = body.rental_unit;
    }
    if (typeof body.base_price === 'number') {
      product.base_price = body.base_price;
    }
    if (body.security_deposit !== undefined) {
      product.security_deposit = body.security_deposit;
    }
    if (body.short_description) {
      product.short_description = body.short_description;
    }
    if (body.full_description) {
      product.full_description = body.full_description;
    }
    if (body.attribute_values) {
      product.attributes = resolveAttributes(body.attribute_values);
    }

    updateTimestamps(product, false);

    return HttpResponse.json({ data: product });
  }),
  http.delete('/api/products/:productId', ({ params }) => {
    const index = products.findIndex((item) => item.id === params.productId);
    if (index === -1) {
      return createErrorResponse(404, {
        code: 'not_found',
        title: 'Продукт не найден',
      });
    }
    products.splice(index, 1);
    return HttpResponse.json(null, { status: 204 });
  }),
  http.get('/api/orders', ({ request }) => {
    const url = new URL(request.url);
    const payload = selectOrders(url);
    if (payload instanceof Response) {
      return payload;
    }
    return HttpResponse.json(payload);
  }),
  http.get('/api/orders/:orderId', ({ params }) => {
    const order = orders.find((item) => item.id === params.orderId);
    if (!order) {
      return createErrorResponse(404, {
        code: 'not_found',
        title: 'Заказ не найден',
      });
    }
    return HttpResponse.json({ data: order });
  }),
  http.post('/api/orders', async ({ request }) => {
    const body = (await request.json()) as {
      customer_id: string;
      company_id?: string | null;
      rental_start_date: string;
      rental_end_date: string;
      items: Array<{
        product_id: string;
        quantity: number;
        rental_days: number;
        unit_price: number;
        deposit_amount?: number;
      }>;
    };

    if (!body.customer_id || !body.items || body.items.length === 0) {
      return createErrorResponse(400, {
        code: 'validation_error',
        title: 'Некорректные данные заказа',
        detail: 'Укажите клиента и хотя бы один товар',
        source: { pointer: '/items' },
      });
    }

    const customer = customers.find((item) => item.id === body.customer_id);
    if (!customer) {
      return createErrorResponse(400, {
        code: 'validation_error',
        title: 'Клиент не найден',
        source: { pointer: '/customer_id' },
      });
    }

    const orderItems: OrderItem[] = body.items.map((item) => {
      const product = products.find((productItem) => productItem.id === item.product_id);
      return {
        id: generateId(),
        product_id: item.product_id,
        bundle_id: null,
        name: product?.name ?? 'Позиция заказа',
        quantity: item.quantity,
        rental_days: item.rental_days,
        unit_price: item.unit_price,
        deposit_amount: item.deposit_amount ?? 0,
        discount_amount: 0,
        status: 'pending',
      };
    });

    const rentalTotal = orderItems.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
    const depositTotal = orderItems.reduce((acc, item) => acc + item.deposit_amount * item.quantity, 0);
    const now = new Date().toISOString();

    const newOrder: Order = {
      id: generateId(),
      code: `ORD-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      customer: {
        id: customer.id,
        display_name: `${customer.first_name} ${customer.last_name}`.trim() || customer.email,
        email: customer.email,
      },
      company:
        body.company_id !== undefined
          ? findCompanySummary(body.company_id) ?? toCompanySummary(customer.company)
          : toCompanySummary(customer.company),
      status: 'new',
      payment_status: 'awaiting',
      channel: 'manager',
      rental_start_date: body.rental_start_date,
      rental_end_date: body.rental_end_date,
      totals: {
        rental_total: rentalTotal,
        delivery_total: 0,
        deposit_total: depositTotal,
        discount_total: 0,
        grand_total: rentalTotal + depositTotal,
      },
      items: orderItems,
      payments: [],
      deposit: {
        id: generateId(),
        expected_amount: depositTotal,
        captured_amount: null,
        status: 'pending',
        captured_at: null,
        released_at: null,
        notes: null,
      },
      created_at: now,
      updated_at: now,
    };

    orders.unshift(newOrder);

    return HttpResponse.json({ data: newOrder }, { status: 201 });
  }),
  http.patch('/api/orders/:orderId', async ({ request, params }) => {
    const order = orders.find((item) => item.id === params.orderId);
    if (!order) {
      return createErrorResponse(404, {
        code: 'not_found',
        title: 'Заказ не найден',
      });
    }

    const body = (await request.json()) as Partial<{ status: Order['status']; payment_status: Order['payment_status'] }>;
    if (body.status) {
      order.status = body.status;
    }
    if (body.payment_status) {
      order.payment_status = body.payment_status;
    }
    updateTimestamps(order, false);

    return HttpResponse.json({ data: order });
  }),
  http.delete('/api/orders/:orderId', ({ params }) => {
    const index = orders.findIndex((item) => item.id === params.orderId);
    if (index === -1) {
      return createErrorResponse(404, {
        code: 'not_found',
        title: 'Заказ не найден',
      });
    }
    orders.splice(index, 1);
    return HttpResponse.json(null, { status: 204 });
  }),
  http.post('/api/orders/:orderId/payments', async ({ params, request }) => {
    const order = orders.find((item) => item.id === params.orderId);
    if (!order) {
      return createErrorResponse(404, {
        code: 'not_found',
        title: 'Заказ не найден',
      });
    }

    const body = (await request.json()) as {
      purpose: Order['payments'][number]['purpose'];
      provider: string;
      method: Order['payments'][number]['method'];
      amount: number;
      currency?: string;
      due_at?: string | null;
    };

    if (!body.amount || !body.method) {
      return createErrorResponse(400, {
        code: 'validation_error',
        title: 'Некорректные данные платежа',
        detail: 'Необходимо указать сумму и метод платежа',
        source: { pointer: '/amount' },
      });
    }

    const payment: Payment = {
      id: generateId(),
      purpose: body.purpose,
      provider: body.provider,
      method: body.method,
      amount: body.amount,
      currency: body.currency ?? 'RUB',
      status: 'succeeded',
      due_at: body.due_at ?? null,
      paid_at: new Date().toISOString(),
      external_reference: `YK-${Math.floor(Math.random() * 1000000)}`,
    };

    order.payments.push(payment);
    order.payment_status = 'paid';
    updateTimestamps(order, false);

    return HttpResponse.json({ data: order }, { status: 201 });
  }),
  http.get('/api/customers', ({ request }) => {
    const url = new URL(request.url);
    const payload = selectCustomers(url);
    if (payload instanceof Response) {
      return payload;
    }
    return HttpResponse.json(payload);
  }),
  http.get('/api/customers/:customerId', ({ params }) => {
    const customer = customers.find((item) => item.id === params.customerId);
    if (!customer) {
      return createErrorResponse(404, {
        code: 'not_found',
        title: 'Клиент не найден',
      });
    }
    return HttpResponse.json({ data: customer });
  }),
  http.post('/api/customers', async ({ request }) => {
    const body = (await request.json()) as {
      email: string;
      phone?: string;
      first_name?: string;
      last_name?: string;
      role: Customer['role'];
      status: Customer['status'];
      company_id?: string | null;
    };

    if (!body.email) {
      return createErrorResponse(400, {
        code: 'validation_error',
        title: 'Некорректные данные клиента',
        detail: 'Поле email обязательно',
        source: { pointer: '/email' },
      });
    }

    const now = new Date().toISOString();
    const newCustomer: Customer = {
      id: generateId(),
      email: body.email,
      phone: body.phone ?? '',
      first_name: body.first_name ?? '',
      last_name: body.last_name ?? '',
      role: body.role,
      status: body.status,
      company: findCustomerCompany(body.company_id ?? null),
      addresses: [],
      contacts: [],
      created_at: now,
    };

    customers.unshift(newCustomer);

    return HttpResponse.json({ data: newCustomer }, { status: 201 });
  }),
  http.patch('/api/customers/:customerId', async ({ request, params }) => {
    const customer = customers.find((item) => item.id === params.customerId);
    if (!customer) {
      return createErrorResponse(404, {
        code: 'not_found',
        title: 'Клиент не найден',
      });
    }

    const body = (await request.json()) as Partial<{
      email: string;
      phone: string;
      first_name: string;
      last_name: string;
      role: Customer['role'];
      status: Customer['status'];
    }>;

    if (body.email) customer.email = body.email;
    if (body.phone) customer.phone = body.phone;
    if (body.first_name) customer.first_name = body.first_name;
    if (body.last_name) customer.last_name = body.last_name;
    if (body.role) customer.role = body.role;
    if (body.status) customer.status = body.status;
    updateTimestamps(customer, false);

    return HttpResponse.json({ data: customer });
  }),
  http.delete('/api/customers/:customerId', ({ params }) => {
    const index = customers.findIndex((item) => item.id === params.customerId);
    if (index === -1) {
      return createErrorResponse(404, {
        code: 'not_found',
        title: 'Клиент не найден',
      });
    }
    customers.splice(index, 1);
    return HttpResponse.json(null, { status: 204 });
  }),
  http.get('/api/inventory-items', ({ request }) => {
    const url = new URL(request.url);
    const payload = selectInventory(url);
    if (payload instanceof Response) {
      return payload;
    }
    return HttpResponse.json(payload);
  }),
  http.get('/api/inventory-items/:inventoryItemId', ({ params }) => {
    const item = inventoryItems.find((entry) => entry.id === params.inventoryItemId);
    if (!item) {
      return createErrorResponse(404, {
        code: 'not_found',
        title: 'Складская позиция не найдена',
      });
    }
    return HttpResponse.json({ data: item });
  }),
  http.post('/api/inventory-items', async ({ request }) => {
    const body = (await request.json()) as {
      product_id: string;
      warehouse_id: string;
      condition: InventoryItem['condition'];
      serial_number?: string | null;
      quantity_total: number;
      status: InventoryItem['status'];
    };

    if (!body.product_id || !body.warehouse_id) {
      return createErrorResponse(400, {
        code: 'validation_error',
        title: 'Некорректные данные склада',
        detail: 'product_id и warehouse_id обязательны',
        source: { pointer: '/product_id' },
      });
    }

    const newItem: InventoryItem = {
      id: generateId(),
      product_id: body.product_id,
      warehouse_id: body.warehouse_id,
      condition: body.condition,
      serial_number: body.serial_number ?? null,
      quantity_total: body.quantity_total,
      quantity_available: body.quantity_total,
      quantity_reserved: 0,
      status: body.status,
      reservations: [],
    };

    inventoryItems.unshift(newItem);

    return HttpResponse.json({ data: newItem }, { status: 201 });
  }),
  http.patch('/api/inventory-items/:inventoryItemId', async ({ request, params }) => {
    const item = inventoryItems.find((entry) => entry.id === params.inventoryItemId);
    if (!item) {
      return createErrorResponse(404, {
        code: 'not_found',
        title: 'Складская позиция не найдена',
      });
    }

    const body = (await request.json()) as Partial<{
      warehouse_id: string;
      condition: InventoryItem['condition'];
      quantity_total: number;
      quantity_available: number;
      quantity_reserved: number;
      status: InventoryItem['status'];
    }>;

    Object.assign(item, body);

    return HttpResponse.json({ data: item });
  }),
  http.delete('/api/inventory-items/:inventoryItemId', ({ params }) => {
    const index = inventoryItems.findIndex((entry) => entry.id === params.inventoryItemId);
    if (index === -1) {
      return createErrorResponse(404, {
        code: 'not_found',
        title: 'Складская позиция не найдена',
      });
    }
    inventoryItems.splice(index, 1);
    return HttpResponse.json(null, { status: 204 });
  }),
  http.get('/api/documents', ({ request }) => {
    const url = new URL(request.url);
    const payload = selectDocuments(url);
    if (payload instanceof Response) {
      return payload;
    }
    return HttpResponse.json(payload);
  }),
  http.get('/api/documents/:documentId', ({ params }) => {
    const document = documents.find((item) => item.id === params.documentId);
    if (!document) {
      return createErrorResponse(404, {
        code: 'not_found',
        title: 'Документ не найден',
      });
    }
    return HttpResponse.json({ data: document });
  }),
  http.post('/api/documents', async ({ request }) => {
    const body = (await request.json()) as {
      order_id: string;
      type: Document['type'];
      file_url: string;
      valid_until?: string | null;
    };

    if (!body.order_id || !body.type || !body.file_url) {
      return createErrorResponse(400, {
        code: 'validation_error',
        title: 'Некорректные данные документа',
        detail: 'order_id, type и file_url обязательны',
        source: { pointer: '/order_id' },
      });
    }

    const now = new Date().toISOString();
    const newDocument: Document = {
      id: generateId(),
      order_id: body.order_id,
      type: body.type,
      status: 'issued',
      file_url: body.file_url,
      version: 1,
      issued_at: now,
      valid_until: body.valid_until ?? null,
    };

    documents.unshift(newDocument);

    return HttpResponse.json({ data: newDocument }, { status: 201 });
  }),
  http.patch('/api/documents/:documentId', async ({ request, params }) => {
    const document = documents.find((item) => item.id === params.documentId);
    if (!document) {
      return createErrorResponse(404, {
        code: 'not_found',
        title: 'Документ не найден',
      });
    }

    const body = (await request.json()) as Partial<{
      status: Document['status'];
      valid_until: string | null;
      file_url: string;
    }>;

    if (body.status) document.status = body.status;
    if (body.valid_until !== undefined) document.valid_until = body.valid_until;
    if (body.file_url) document.file_url = body.file_url;

    return HttpResponse.json({ data: document });
  }),
  http.delete('/api/documents/:documentId', ({ params }) => {
    const index = documents.findIndex((item) => item.id === params.documentId);
    if (index === -1) {
      return createErrorResponse(404, {
        code: 'not_found',
        title: 'Документ не найден',
      });
    }
    documents.splice(index, 1);
    return HttpResponse.json(null, { status: 204 });
  }),
];

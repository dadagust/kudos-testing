export type OrderStatus = 'new' | 'reserved' | 'rented' | 'in_work' | 'archived' | 'declined';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Новый',
  reserved: 'В резерве',
  rented: 'В аренде',
  in_work: 'В работе',
  archived: 'Архив',
  declined: 'Отказ',
};

export type OrderStatusGroup = 'current' | 'archived' | 'cancelled';

export type DeliveryType = 'delivery' | 'pickup';

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  delivery: 'Доставка',
  pickup: 'Самовывоз',
};

export interface CustomerSummary {
  id: string;
  display_name: string;
}

export type OrderProductId = 'product_1' | 'product_2';

export interface OrderProductInfo {
  id: OrderProductId;
  name: string;
  price: number;
}

export const ORDER_PRODUCTS: OrderProductInfo[] = [
  { id: 'product_1', name: 'Товар 1', price: 1500 },
  { id: 'product_2', name: 'Товар 2', price: 2500 },
];

export const getOrderProductInfo = (productId: OrderProductId): OrderProductInfo => {
  const product = ORDER_PRODUCTS.find((item) => item.id === productId);
  if (!product) {
    return { id: productId, name: productId, price: 0 } as OrderProductInfo;
  }
  return product;
};

export interface OrderItem {
  id: number;
  product: OrderProductId;
  product_label: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

export interface OrderSummary {
  id: number;
  status: OrderStatus;
  status_label: string;
  total_amount: string;
  installation_date: string;
  dismantle_date: string;
  customer: CustomerSummary | null;
  delivery_type: DeliveryType;
  delivery_type_label: string;
  delivery_address: string;
  comment: string;
  created: string;
  modified: string;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
}

export interface OrderListResponse {
  data: OrderSummary[];
}

export interface OrderDetailResponse {
  data: OrderDetail;
}

export interface OrderListQuery {
  status_group?: OrderStatusGroup;
  status?: OrderStatus;
  search?: string;
}

export interface OrderItemPayload {
  product: OrderProductId;
  quantity: number;
}

export interface CreateOrderPayload {
  status?: OrderStatus;
  installation_date: string;
  dismantle_date: string;
  customer_id?: string | null;
  delivery_type: DeliveryType;
  delivery_address?: string | null;
  comment?: string | null;
  items: OrderItemPayload[];
}

export type UpdateOrderPayload = CreateOrderPayload;

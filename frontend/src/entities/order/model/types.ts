export type OrderStatus =
  | 'new'
  | 'reserved'
  | 'in_rent'
  | 'in_progress'
  | 'archived'
  | 'cancelled';

export type OrderDeliveryMethod = 'delivery' | 'pickup';

export type OrderScope = 'current' | 'archived' | 'cancelled';

export interface OrderItem {
  id: number;
  product: string;
  product_label: string;
  quantity: number;
  unit_price: string;
  total_price: string;
}

export interface OrderSummary {
  id: number;
  number: string;
  status: OrderStatus;
  status_label: string;
  total_amount: string;
  installation_date: string;
  dismantle_date: string;
  customer: string | null;
  customer_name: string;
  delivery_method: OrderDeliveryMethod;
  delivery_address: string;
  comment: string;
  created_at: string;
  updated_at: string;
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
  scope?: OrderScope;
  status?: OrderStatus;
  search?: string;
  customer?: string;
}

export interface OrderItemInput {
  product: string;
  quantity: number;
}

export interface OrderCreatePayload {
  status: OrderStatus;
  installation_date: string;
  dismantle_date: string;
  customer_id?: string | null;
  delivery_method: OrderDeliveryMethod;
  delivery_address?: string;
  comment?: string;
  items: OrderItemInput[];
}

export type OrderUpdatePayload = Partial<OrderCreatePayload> & {
  items?: OrderItemInput[];
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Новый',
  reserved: 'В резерве',
  in_rent: 'В аренде',
  in_progress: 'В работе',
  archived: 'Архив',
  cancelled: 'Отказ',
};

export const ORDER_PRODUCT_OPTIONS = [
  { value: 'product1', label: 'Товар 1', price: 1500 },
  { value: 'product2', label: 'Товар 2', price: 2750 },
  { value: 'product3', label: 'Товар 3', price: 4200 },
];

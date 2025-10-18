export type OrderStatus =
  | 'new'
  | 'reserved'
  | 'in_rent'
  | 'in_progress'
  | 'archived'
  | 'cancelled';

export type DeliveryOption = 'delivery' | 'pickup';

export type OrderProductCode = 'product_1' | 'product_2';

export interface OrderItem {
  id: number;
  product: OrderProductCode;
  product_label: string;
  quantity: number;
  unit_price: string;
  amount: string;
  created: string;
  modified: string;
}

export interface OrderSummary {
  id: number;
  status: OrderStatus;
  status_label: string;
  total_amount: string;
  installation_date: string;
  dismantle_date: string;
  customer: string | null;
  customer_name: string;
  delivery_option: DeliveryOption;
  delivery_option_label: string;
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
  status?: OrderStatus[];
  search?: string;
  customer?: string;
}

export interface OrderItemInput {
  id?: number;
  product: OrderProductCode;
  quantity: number;
}

export interface CreateOrderPayload {
  status: OrderStatus;
  installation_date: string;
  dismantle_date: string;
  customer?: string | null;
  delivery_option: DeliveryOption;
  delivery_address?: string;
  comment?: string;
  items: OrderItemInput[];
}

export type UpdateOrderPayload = CreateOrderPayload;

export interface OrderProductOption {
  code: OrderProductCode;
  name: string;
  price: number;
}

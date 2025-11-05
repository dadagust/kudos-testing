import type { RentalMode, RentalTier } from '@/entities/product';

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

export interface OrderItemProductSummary {
  id: string;
  name: string;
  price_rub: number;
  color?: string | null;
  thumbnail_url?: string | null;
}

export interface OrderItem {
  id: number;
  product: OrderItemProductSummary | null;
  product_name: string;
  quantity: number;
  rental_days: number;
  rental_mode: RentalMode;
  rental_tiers?: RentalTier[] | null;
  unit_price: string;
  subtotal: string;
}

export interface OrderSummary {
  id: number;
  status: OrderStatus;
  status_label: string;
  total_amount: string;
  services_total_amount: string;
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

export interface OrderCalculationItem {
  product_id: string;
  quantity: number;
  rental_days: number;
  unit_price: string;
  subtotal: string;
}

export interface OrderCalculationSummary {
  total_amount: string;
  qualification_total: string;
  items: OrderCalculationItem[];
}

export interface OrderCalculationResponse {
  data: OrderCalculationSummary;
}

export interface OrderListQuery {
  status_group?: OrderStatusGroup;
  status?: OrderStatus;
  search?: string;
}

export interface OrderItemPayload {
  product_id: string;
  quantity: number;
  rental_days: number;
  rental_mode?: RentalMode;
  rental_tiers?: RentalTier[];
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

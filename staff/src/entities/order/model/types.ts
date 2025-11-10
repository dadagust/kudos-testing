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

export type PaymentStatus = 'paid' | 'unpaid' | 'partially_paid';

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: 'оплачен',
  unpaid: 'не оплачен',
  partially_paid: 'частично оплачен',
};

export type LogisticsState = 'handover_to_picking' | 'picked' | 'shipped';

export const LOGISTICS_STATE_LABELS: Record<LogisticsState, string> = {
  handover_to_picking: 'Передан на сборку',
  picked: 'Собран',
  shipped: 'Отгружен',
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
  payment_status: PaymentStatus;
  payment_status_label: string;
  logistics_state: LogisticsState | null;
  logistics_state_label: string | null;
  total_amount: string;
  services_total_amount: string;
  installation_date: string;
  dismantle_date: string;
  shipment_date: string | null;
  customer: CustomerSummary | null;
  delivery_type: DeliveryType;
  delivery_type_label: string;
  delivery_address: string;
  comment: string;
  warehouse_received_at: string | null;
  warehouse_received_by: number | null;
  is_warehouse_received: boolean;
  created: string;
  modified: string;
  items: OrderItem[];
}

export interface OrderDetail extends OrderSummary {}

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
  payment_status?: PaymentStatus[];
  logistics_state?: Array<LogisticsState | 'null'>;
  shipment_date_from?: string;
  shipment_date_to?: string;
  q?: string;
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
  payment_status?: PaymentStatus;
  logistics_state?: LogisticsState | null;
  installation_date: string;
  dismantle_date: string;
  shipment_date?: string | null;
  customer_id?: string | null;
  delivery_type: DeliveryType;
  delivery_address?: string | null;
  comment?: string | null;
  items: OrderItemPayload[];
}

export type UpdateOrderPayload = CreateOrderPayload;

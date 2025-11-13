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

export type OrderWaybillContext = 'prep' | 'receiving';

export interface CustomerSummary {
  id: string;
  display_name: string;
  phone: string;
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
  mount_datetime_from: string | null;
  mount_datetime_to: string | null;
  dismantle_date: string;
  dismount_datetime_from: string | null;
  dismount_datetime_to: string | null;
  shipment_date: string | null;
  customer: CustomerSummary | null;
  delivery_type: DeliveryType;
  delivery_type_label: string;
  delivery_address: string;
  delivery_address_input: string;
  delivery_address_full: string;
  delivery_lat: number | null;
  delivery_lon: number | null;
  delivery_address_kind: string;
  delivery_address_precision: string;
  yandex_uri: string;
  has_exact_address: boolean;
  comment: string;
  comment_for_waybill: string;
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

export interface OrderDriverSummary {
  id: number;
  full_name: string;
  phone: string;
  created: string;
  modified: string;
}

export interface OrderDriverResponse {
  data: OrderDriverSummary;
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
  installation_date_from?: string;
  installation_date_to?: string;
  dismantle_date_from?: string;
  dismantle_date_to?: string;
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
  mount_datetime_from: string | null;
  mount_datetime_to: string | null;
  dismantle_date: string;
  dismount_datetime_from: string | null;
  dismount_datetime_to: string | null;
  shipment_date?: string | null;
  customer_id?: string | null;
  delivery_type: DeliveryType;
  delivery_address?: string | null;
  comment?: string | null;
  comment_for_waybill?: string | null;
  items: OrderItemPayload[];
}

export type UpdateOrderPayload = CreateOrderPayload;

export interface OrderValidateAddressResponse {
  ok: boolean;
  exists: boolean;
  normalized: string;
  lat: number | null;
  lon: number | null;
  kind: string;
  precision: string;
  uri: string;
  order: OrderSummary;
}

export interface OrderWithCoordsItem {
  id: number;
  address: string;
  lat: number;
  lon: number;
  exact: boolean;
  driver: OrderDriverSummary | null;
  installation_date: string | null;
  mount_datetime_from: string | null;
  mount_datetime_to: string | null;
  dismantle_date: string | null;
  dismount_datetime_from: string | null;
  dismount_datetime_to: string | null;
}

export interface OrdersWithCoordsResponse {
  items: OrderWithCoordsItem[];
}

export interface AssignOrderDriverPayload {
  full_name: string;
  phone: string;
}

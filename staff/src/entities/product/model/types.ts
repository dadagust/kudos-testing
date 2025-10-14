export type ProductStatus = 'draft' | 'active' | 'archived';
export type AvailabilityStatus = 'in_stock' | 'reserved' | 'out_of_stock';
export type RentalUnit = 'day' | 'hour';

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
}

export interface ProductMedia {
  id: string;
  type: string;
  url: string;
  alt_text: string;
  is_primary: boolean;
  sort_order?: number;
}

export interface ProductAttribute {
  attribute_id: string;
  code: string;
  name: string;
  value: string;
  unit: string | null;
}

export interface ProductSummary extends Record<string, unknown> {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  status: ProductStatus;
  availability_status: AvailabilityStatus;
  rental_unit: RentalUnit;
  base_price: number;
  security_deposit: number | null;
  short_description: string;
  updated_at: string;
}

export interface ProductDetail extends ProductSummary {
  slug: string;
  full_description: string;
  media: ProductMedia[];
  attributes: ProductAttribute[];
  created_at: string;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ProductListMeta {
  pagination: PaginationMeta;
}

export interface ProductFilterOption<TValue extends string = string> {
  value: TValue;
  label: string;
}

export interface ProductListFilters {
  statuses: ProductFilterOption<ProductStatus>[];
  availability_statuses: ProductFilterOption<AvailabilityStatus>[];
  categories: ProductCategory[];
  sort: ProductFilterOption[];
}

export interface ProductListResponse {
  data: ProductSummary[];
  meta: ProductListMeta;
  filters: ProductListFilters;
  trace_id: string;
}

export interface ProductDetailResponse {
  data: ProductDetail;
  trace_id: string;
}

export interface ProductListQuery {
  search?: string;
  status?: ProductStatus | '';
  category_id?: string | '';
  availability_status?: AvailabilityStatus | '';
  sort?: string;
  page?: number;
  page_size?: number;
}

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  active: 'Активен',
  draft: 'Черновик',
  archived: 'Архив',
};

export const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  in_stock: 'В наличии',
  reserved: 'В резерве',
  out_of_stock: 'Нет в наличии',
};

export const RENTAL_UNIT_LABELS: Record<RentalUnit, string> = {
  day: 'сутки',
  hour: 'час',
};

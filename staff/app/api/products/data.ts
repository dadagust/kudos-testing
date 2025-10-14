import productsFixture from './products.json';

export type ProductStatus = 'draft' | 'active' | 'archived';
export type AvailabilityStatus = 'in_stock' | 'reserved' | 'out_of_stock';
export type RentalUnit = 'day' | 'hour';

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

export interface MediaAsset {
  id: string;
  type: string;
  url: string;
  alt_text: string;
  is_primary: boolean;
  sort_order?: number;
}

export interface AttributeValue {
  attribute_id: string;
  code: string;
  name: string;
  value: string;
  unit: string | null;
}

export interface ProductEntity {
  id: string;
  category: CategorySummary;
  sku: string;
  name: string;
  slug: string;
  status: ProductStatus;
  availability_status: AvailabilityStatus;
  rental_unit: RentalUnit;
  base_price: number;
  security_deposit: number | null;
  short_description: string;
  full_description: string;
  media: MediaAsset[];
  attributes: AttributeValue[];
  created_at: string;
  updated_at: string;
}

export const PRODUCTS: ProductEntity[] = productsFixture as ProductEntity[];

export const PRODUCT_STATUSES: ProductStatus[] = ['active', 'draft', 'archived'];
export const AVAILABILITY_STATUSES: AvailabilityStatus[] = ['in_stock', 'reserved', 'out_of_stock'];

export type ProductStatus = 'draft' | 'active' | 'archived';

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Черновик',
  active: 'Активен',
  archived: 'Архив',
};

export type AvailabilityStatus = 'in_stock' | 'reserved' | 'out_of_stock';

export const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  in_stock: 'В наличии',
  reserved: 'В резерве',
  out_of_stock: 'Нет в наличии',
};

export type RentalUnit = 'day' | 'hour';

export const RENTAL_UNIT_LABELS: Record<RentalUnit, string> = {
  day: 'За день',
  hour: 'За час',
};

export type ProductColor =
  | 'white'
  | 'gray'
  | 'black'
  | 'red'
  | 'orange'
  | 'brown'
  | 'yellow'
  | 'green'
  | 'turquoise'
  | 'blue'
  | 'violet';

export type DimensionShape =
  | 'circle__diameter'
  | 'line__length'
  | 'rectangle__length_width'
  | 'cylinder__diameter_height'
  | 'box__height_width_depth';

export type TransportRestriction =
  | 'any'
  | 'truck_only'
  | 'heavy_only'
  | 'heavy16_only'
  | 'special2_only';

export type InstallerQualification = 'any' | 'worker_with_steam_generator';

export type ReservationMode = 'operator_only' | 'online_allowed' | 'disabled';

export type RentalBasePeriod = 'standard';

export interface ProductDimensions {
  shape: DimensionShape;
  circle?: { diameter_cm: number };
  line?: { length_cm: number };
  rectangle?: { length_cm: number; width_cm: number };
  cylinder?: { diameter_cm: number; height_cm: number };
  box?: { height_cm: number; width_cm: number; depth_cm: number };
}

export interface ProductImage {
  id: string;
  url: string;
  position: number;
}

export interface ProductImage {
  id: string;
  url: string;
  alt_text: string;
  is_primary: boolean;
  sort_order?: number | null;
}

export interface ProductOccupancy {
  cleaning_days?: number | null;
  insurance_reserve_percent?: number | null;
}

export interface ProductCategorySummary {
  id: string;
  name: string;
  slug?: string;
}

export interface ProductOccupancy {
  cleaning_days?: number | null;
  insurance_reserve_percent?: number | null;
}

export interface ProductDelivery {
  volume_cm3?: number | null;
  weight_kg?: string | number | null;
  transport_restriction?: TransportRestriction | null;
  self_pickup_allowed: boolean;
}

export interface ProductSetup {
  install_minutes?: number | null;
  uninstall_minutes?: number | null;
  installer_qualification?: InstallerQualification | null;
  min_installers?: number | null;
  self_setup_allowed: boolean;
}

export interface ProductRental {
  base_period?: RentalBasePeriod | null;
}

export interface ProductVisibility {
  reservation_mode?: ReservationMode | null;
  show_on_pifakit: boolean;
  show_on_site: boolean;
  show_in_new: boolean;
  category_cover_on_home: boolean;
}

export interface ProductSeo {
  slug?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string[];
}

export interface ProductListItem {
  id: string;
  name: string;
  price_rub: number;
  color?: ProductColor | null;
  category_id?: string;
  thumbnail_url?: string | null;
  delivery: Pick<ProductDelivery, 'transport_restriction' | 'self_pickup_allowed'>;
  dimensions?: ProductDimensions;
  seo?: ProductSeo;
  images?: ProductImage[];
  status?: ProductStatus;
  availability_status?: AvailabilityStatus;
  rental_unit?: RentalUnit;
  base_price?: number;
  security_deposit?: number | null;
  short_description?: string;
  updated_at?: string;
}

export interface ProductDetail extends ProductListItem {
  category: ProductCategorySummary;
  sku: string;
  slug: string;
  status: ProductStatus;
  availability_status: AvailabilityStatus;
  rental_unit: RentalUnit;
  base_price: number;
  security_deposit: number | null;
  short_description: string;
  full_description: string;
  media: ProductMedia[];
  attributes: ProductAttribute[];
  features?: string[];
  loss_compensation_rub?: number | null;
  occupancy?: ProductOccupancy;
  delivery: ProductDelivery;
  setup?: ProductSetup;
  rental?: ProductRental;
  visibility?: ProductVisibility;
  seo?: ProductSeo;
  images: ProductImage[];
  created_at: string;
  updated_at: string;
}

export interface ProductListResponse {
  results: ProductListItem[];
  next_cursor: string | null;
}

export interface ProductDetailResponse extends ProductDetail {}

export interface ProductListQuery {
  limit?: number;
  cursor?: string | null;
  q?: string;
  category_id?: string;
  color?: ProductColor;
  transport_restriction?: TransportRestriction;
  self_pickup?: boolean;
  price_min?: number;
  price_max?: number;
  ordering?:
    | 'created_at'
    | '-created_at'
    | 'price_rub'
    | '-price_rub'
    | 'updated_at'
    | '-updated_at'
    | 'name'
    | '-name';
  include?: string;
}

export interface ProductCategoriesResponseItem {
  id: string;
  name: string;
  children?: ProductCategoriesResponseItem[];
}

export interface EnumOption {
  value: string;
  label: string;
}

export interface ProductEnumsResponse {
  colors: EnumOption[];
  shapes: EnumOption[];
  transport_restrictions: EnumOption[];
  installer_qualifications: EnumOption[];
  reservation_modes: EnumOption[];
  rental_base_periods: EnumOption[];
}

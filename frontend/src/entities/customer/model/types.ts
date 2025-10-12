export type CustomerType = 'personal' | 'business';

export interface CompanySummary {
  id: string;
  name: string;
  legal_name: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AddressSummary {
  id: string;
  address_type: string;
  title: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  is_primary: boolean;
  latitude: string | null;
  longitude: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactSummary {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  notes: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerSummary extends Record<string, unknown> {
  id: string;
  customer_type: CustomerType;
  full_name: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  gdpr_consent: boolean;
  company: CompanySummary | null;
  owner_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerDetail extends CustomerSummary {
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  notes: string | null;
  addresses: AddressSummary[];
  contacts: ContactSummary[];
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginationResponse {
  pagination: PaginationMeta;
}

export interface NavigationLinks {
  self: string;
  first: string;
  last: string;
  next: string | null;
  prev: string | null;
}

export interface CustomerListResponse {
  data: CustomerSummary[];
  meta?: PaginationResponse;
  links?: NavigationLinks;
}

export interface CustomerDetailResponse {
  data: CustomerDetail;
}

export interface CustomerListQuery {
  page?: number;
  page_size?: number;
  search?: string;
  sort?: string;
  email?: string;
  phone?: string;
  company_id?: string;
  tags?: string[];
  created_from?: string;
  created_to?: string;
}

export interface CompanyInput {
  id?: string;
  name?: string;
  legal_name?: string;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  email?: string;
  phone?: string;
  website?: string;
  notes?: string;
}

export interface CustomerCreatePayload {
  customer_type: CustomerType;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  display_name?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  gdpr_consent?: boolean;
  company?: CompanyInput | null;
  notes?: string;
  owner_id?: number | null;
}

export interface CustomerUpdatePayload extends CustomerCreatePayload {}

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  personal: 'Физическое лицо',
  business: 'Юридическое лицо',
};

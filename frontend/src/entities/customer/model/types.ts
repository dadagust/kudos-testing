export type CustomerType = 'personal' | 'business';

export interface CustomerCompany {
  id: string;
  name: string;
  legal_name: string;
  inn: string;
  kpp: string;
  ogrn: string;
  email: string;
  phone: string;
  website: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerSummary {
  id: string;
  customer_type: CustomerType;
  full_name: string;
  display_name: string;
  email: string;
  phone: string;
  gdpr_consent: boolean;
  company: CustomerCompany | null;
  owner_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  notes: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerDetail extends CustomerSummary {
  first_name: string;
  last_name: string;
  middle_name: string;
  notes: string;
  contacts: Contact[];
}

export interface CustomerCompanyInput {
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

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface CustomerListResponse {
  data: CustomerSummary[];
  meta?: {
    pagination: PaginationMeta;
  };
  links?: {
    self: string;
    first: string;
    last: string;
    next: string | null;
    prev: string | null;
  };
}

export interface CustomerDetailResponse {
  data: CustomerDetail;
}

export interface CustomerListQuery {
  search?: string;
  email?: string;
  phone?: string;
  company_id?: string;
  created_from?: string;
  created_to?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}

export interface CreateCustomerPayload {
  customer_type: CustomerType;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  display_name?: string;
  email?: string;
  phone?: string;
  gdpr_consent?: boolean;
  notes?: string;
}

export interface UpdateCustomerPayload extends CreateCustomerPayload {
  company?: CustomerCompanyInput | null;
  owner_id?: number | null;
}

export type IntegrationProvider = 'amocrm' | 'yookassa' | 'yandex_geocoder';
export type IntegrationStatus = 'connected' | 'draft' | 'error' | 'disabled';

export interface IntegrationMetrics {
  success_operations: number;
  failed_operations: number;
  last_error?: string | null;
}

export type IntegrationCapability = 'crm' | 'payments' | 'geocoding' | 'webhooks';

export interface IntegrationDescriptor {
  id: string;
  provider: IntegrationProvider;
  name: string;
  status: IntegrationStatus;
  description: string;
  connected_by: string;
  last_synced_at: string | null;
  settings_summary: string;
  metrics: IntegrationMetrics;
  capabilities: IntegrationCapability[];
}

export interface IntegrationSummary extends IntegrationDescriptor {
  provider_label: string;
  status_label: string;
}

export interface IntegrationsResponse {
  data: IntegrationSummary[];
  trace_id: string;
}

export interface IntegrationAdapter {
  readonly id: string;
  readonly provider: IntegrationProvider;
  readonly name: string;
  readonly description: string;
  readonly capabilities: IntegrationCapability[];
  fetchDescriptor(): Promise<IntegrationDescriptor>;
}

export const INTEGRATION_STATUS_TONE: Record<
  IntegrationStatus,
  'success' | 'warning' | 'danger' | 'info'
> = {
  connected: 'success',
  draft: 'info',
  error: 'danger',
  disabled: 'warning',
};

export const INTEGRATION_CAPABILITY_LABELS: Record<IntegrationCapability, string> = {
  crm: 'CRM',
  payments: 'Платежи',
  geocoding: 'Геокодинг',
  webhooks: 'Вебхуки',
};

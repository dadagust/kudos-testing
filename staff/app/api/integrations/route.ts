import { NextResponse } from 'next/server';

import { formatDateTimeDisplay } from '@/shared/lib/date';

import { listIntegrationDescriptors } from './adapters';

const statusLabels: Record<string, string> = {
  connected: 'Подключено',
  draft: 'Черновик',
  error: 'Ошибка',
  disabled: 'Отключено',
};

const providerLabels: Record<string, string> = {
  amocrm: 'AmoCRM',
  yookassa: 'ЮKassa',
  yandex_geocoder: 'Яндекс Геокодер',
};

const toTraceId = () =>
  `trace_${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16)}`;

export async function GET() {
  const traceId = toTraceId();
  const descriptors = await listIntegrationDescriptors();
  const response = NextResponse.json(
    {
      data: descriptors.map((integration) => ({
        ...integration,
        last_synced_at:
          integration.last_synced_at == null
            ? null
            : (formatDateTimeDisplay(integration.last_synced_at) ?? integration.last_synced_at),
        status_label: statusLabels[integration.status] ?? integration.status,
        provider_label: providerLabels[integration.provider] ?? integration.provider,
      })),
      trace_id: traceId,
    },
    { status: 200 }
  );

  response.headers.set('x-trace-id', traceId);
  return response;
}

'use client';

import {
  INTEGRATION_CAPABILITY_LABELS,
  INTEGRATION_STATUS_TONE,
  useIntegrationsQuery,
} from '@/entities/integration';
import { RoleGuard } from '@/features/auth';
import { Role } from '@/shared/config/roles';
import { Alert, Badge, Button, Spinner, Tag } from '@/shared/ui';

const formatDateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Ещё не синхронизировалось';

export default function IntegrationsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useIntegrationsQuery();

  return (
    <RoleGuard allow={[Role.Admin]}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h1>Интеграции</h1>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '48rem' }}>
            Управление подключением AmoCRM, ЮKassa и геосервисов. На этом этапе данные берутся из
            моков, но интерфейсы повторяют будущие API. Каждая запись содержит статистику
            синхронизаций и статус подключения.
          </p>
        </div>
        <Button variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Обновляем…' : 'Обновить'}
        </Button>
      </header>

      {isLoading ? <Spinner label="Получаем статусы интеграций" /> : null}

      {isError ? (
        <Alert tone="danger" title="Не удалось загрузить интеграции">
          {error instanceof Error ? error.message : 'Попробуйте повторить попытку позже.'}
        </Alert>
      ) : null}

      <div style={{ display: 'grid', gap: '16px', marginTop: '24px' }}>
        {data?.data.map((integration) => (
          <article
            key={integration.id}
            style={{
              background: 'var(--color-surface)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <strong style={{ fontSize: '1.125rem' }}>{integration.name}</strong>
                <span style={{ color: 'var(--color-text-muted)' }}>{integration.description}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Tag>{integration.provider_label}</Tag>
                <Badge tone={INTEGRATION_STATUS_TONE[integration.status] ?? 'info'}>
                  {integration.status_label}
                </Badge>
              </div>
            </div>

            {integration.capabilities.length ? (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {integration.capabilities.map((capability) => (
                  <Tag key={`${integration.id}-${capability}`}>
                    {INTEGRATION_CAPABILITY_LABELS[capability] ?? capability}
                  </Tag>
                ))}
              </div>
            ) : null}

            <div
              style={{
                display: 'grid',
                gap: '12px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  Последняя синхронизация
                </span>
                <strong>{formatDateTime(integration.last_synced_at)}</strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  Успешно
                </span>
                <strong>{integration.metrics.success_operations}</strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  Ошибки
                </span>
                <strong>{integration.metrics.failed_operations}</strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  Настройки
                </span>
                <span>{integration.settings_summary}</span>
              </div>
            </div>

            {integration.metrics.last_error ? (
              <Alert tone="danger" title="Последняя ошибка">
                {integration.metrics.last_error}
              </Alert>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="ghost">Настроить</Button>
            </div>
          </article>
        ))}
      </div>

      {data?.trace_id ? (
        <div style={{ marginTop: '16px' }}>
          <Tag>Trace ID: {data.trace_id}</Tag>
        </div>
      ) : null}
    </RoleGuard>
  );
}

'use client';

import { useMemo } from 'react';

import { RoleGuard } from '@/features/auth';
import { ensureDateTimeDisplay, toTimestamp } from '@/shared/lib/date';
import { useAuditLogStore } from '@/shared/state/audit-log-store';
import type { AuditLogEntry } from '@/shared/state/audit-log-store';
import { Badge, Button, Table, Tag } from '@/shared/ui';
import type { TableColumn } from '@/shared/ui';

const LEVEL_LABELS: Record<string, string> = {
  info: 'Инфо',
  success: 'Успех',
  warning: 'Предупреждение',
  error: 'Ошибка',
};

const LEVEL_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'danger',
};

const formatDateTime = (value: string) => ensureDateTimeDisplay(value);

export default function LogsPage() {
  const entries = useAuditLogStore((state) => state.entries);
  const clear = useAuditLogStore((state) => state.clear);

  const data = useMemo<AuditLogEntry[]>(() => {
    const sorted = entries.slice();
    sorted.sort((a, b) => {
      const aTime = toTimestamp(a.timestamp);
      const bTime = toTimestamp(b.timestamp);
      if (aTime !== null && bTime !== null) {
        return bTime - aTime;
      }
      if (aTime !== null) {
        return -1;
      }
      if (bTime !== null) {
        return 1;
      }
      return a.timestamp < b.timestamp ? 1 : -1;
    });
    return sorted;
  }, [entries]);

  const columns: TableColumn<AuditLogEntry>[] = [
    {
      key: 'timestamp',
      header: 'Когда',
      render: (row) => formatDateTime(row.timestamp),
    },
    {
      key: 'level',
      header: 'Уровень',
      render: (row) => (
        <Badge tone={LEVEL_TONE[row.level] ?? 'info'}>{LEVEL_LABELS[row.level] ?? row.level}</Badge>
      ),
    },
    {
      key: 'actor',
      header: 'Пользователь',
      render: (row) => row.actor,
    },
    {
      key: 'message',
      header: 'Событие',
      render: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <strong>{row.action}</strong>
          <span>{row.message}</span>
          {row.context ? (
            <code
              style={{
                fontSize: '0.75rem',
                background: 'rgba(0,0,0,0.04)',
                padding: '2px 4px',
                borderRadius: '6px',
              }}
            >
              {JSON.stringify(row.context)}
            </code>
          ) : null}
        </div>
      ),
    },
    {
      key: 'traceId',
      header: 'Trace ID',
      render: (row) => (row.traceId ? <Tag>{row.traceId}</Tag> : '—'),
    },
  ];

  return (
    <RoleGuard allow={['adminpanel_view_logs', 'documents_view_document']}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h1>Аудит и логи</h1>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '48rem' }}>
            История действий и сетевых запросов. Клиентский логгер фиксирует каждый запрос к API,
            сохраняет trace ID и контекст ответа. Данные обновляются в реальном времени.
          </p>
        </div>
        <Button variant="ghost" onClick={clear} disabled={!entries.length}>
          Очистить журнал
        </Button>
      </header>

      <Table
        columns={columns}
        data={data}
        emptyMessage="Журнал пока пуст. Выполните действия в системе, чтобы появились записи."
      />
    </RoleGuard>
  );
}

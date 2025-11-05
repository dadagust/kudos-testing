import { create } from 'zustand';

export type AuditLogLevel = 'info' | 'success' | 'warning' | 'error';

export interface AuditLogEntry extends Record<string, unknown> {
  id: string;
  timestamp: string;
  level: AuditLogLevel;
  action: string;
  message: string;
  actor: string;
  traceId?: string;
  context?: Record<string, unknown>;
}

interface AuditLogState {
  entries: AuditLogEntry[];
  addEntry: (entry: AuditLogEntry) => void;
  clear: () => void;
}

const seedEntries: AuditLogEntry[] = [
  {
    id: 'seed-log-1',
    timestamp: '12.10.2025 09:40:00',
    level: 'success',
    action: 'INTEGRATION_SYNC',
    message: 'AmoCRM: синхронизация сделок завершена успешно (12 изменений).',
    actor: 'system',
    traceId: 'trace_seed_001',
  },
  {
    id: 'seed-log-2',
    timestamp: '12.10.2025 08:55:00',
    level: 'info',
    action: 'USER_ACTION',
    message: 'Менеджер manager@kudos.ru обновил карточку товара «Диван Velour Oslo».',
    actor: 'manager@kudos.ru',
    traceId: 'trace_seed_002',
  },
  {
    id: 'seed-log-3',
    timestamp: '11.10.2025 01:51:00',
    level: 'error',
    action: 'INTEGRATION_ERROR',
    message: 'AmoCRM Webhook вернул ошибку 401 Unauthorized.',
    actor: 'system',
    traceId: 'trace_seed_003',
    context: {
      endpoint: '/integrations/amocrm/callback',
    },
  },
];

export const useAuditLogStore = create<AuditLogState>((set) => ({
  entries: seedEntries,
  addEntry: (entry) =>
    set((state) => ({
      entries: [entry, ...state.entries].slice(0, 200),
    })),
  clear: () => set({ entries: [] }),
}));

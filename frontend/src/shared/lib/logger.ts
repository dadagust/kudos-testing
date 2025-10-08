import { AuditLogLevel, useAuditLogStore } from '../state/audit-log-store';

const createLogId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `log-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const nowIsoString = () => new Date().toISOString();

interface LogPayload {
  level: AuditLogLevel;
  action: string;
  message: string;
  actor?: string;
  traceId?: string;
  context?: Record<string, unknown>;
  timestamp?: string;
}

interface HttpLogPayload {
  method?: string;
  url: string;
  traceId: string;
  status?: number;
  message?: string;
}

const normaliseMethod = (method?: string) => (method ? method.toUpperCase() : 'GET');

export const auditLogger = {
  log: ({ level, action, message, actor = 'system', traceId, context, timestamp }: LogPayload) => {
    const entry = {
      id: createLogId(),
      timestamp: timestamp ?? nowIsoString(),
      level,
      action,
      message,
      actor,
      traceId,
      context,
    };

    useAuditLogStore.getState().addEntry(entry);
  },
  logRequest: ({ method, url, traceId }: HttpLogPayload) => {
    auditLogger.log({
      level: 'info',
      action: 'HTTP_REQUEST',
      message: `${normaliseMethod(method)} ${url}`,
      traceId,
    });
  },
  logResponse: ({ method, url, status, traceId }: HttpLogPayload) => {
    auditLogger.log({
      level: status && status >= 400 ? 'warning' : 'success',
      action: 'HTTP_RESPONSE',
      message: `${normaliseMethod(method)} ${url}${status ? ` → ${status}` : ''}`,
      traceId,
    });
  },
  logError: ({ method, url, status, traceId, message }: HttpLogPayload) => {
    auditLogger.log({
      level: 'error',
      action: 'HTTP_ERROR',
      message: `${normaliseMethod(method)} ${url}${status ? ` → ${status}` : ''}`,
      traceId,
      context: message ? { error: message } : undefined,
    });
  },
};

export type AuditLogger = typeof auditLogger;

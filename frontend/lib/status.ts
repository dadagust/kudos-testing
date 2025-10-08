export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger';

export type StatusConfig = {
  label: string;
  tone: StatusTone;
};

type StatusDictionary = Record<string, StatusConfig>;

export const orderStatusMap: StatusDictionary = {
  in_progress: { label: 'В работе', tone: 'warning' },
  reserved: { label: 'В резерве', tone: 'warning' },
  completed: { label: 'Завершён', tone: 'success' },
  cancelled: { label: 'Отменён', tone: 'danger' },
  draft: { label: 'Черновик', tone: 'neutral' },
};

export const paymentStatusMap: StatusDictionary = {
  partial: { label: 'Частично оплачено', tone: 'warning' },
  awaiting: { label: 'Ожидает оплаты', tone: 'warning' },
  paid: { label: 'Оплачено', tone: 'success' },
  refunded: { label: 'Возврат', tone: 'neutral' },
};

export const availabilityStatusMap: StatusDictionary = {
  in_stock: { label: 'В наличии', tone: 'success' },
  low_stock: { label: 'Мало в наличии', tone: 'warning' },
  out_of_stock: { label: 'Нет в наличии', tone: 'danger' },
};

export function resolveStatus(
  value: string | null | undefined,
  dictionary: StatusDictionary,
  fallbackLabel?: string,
): StatusConfig {
  if (!value) {
    return { label: fallbackLabel ?? 'Не указано', tone: 'neutral' };
  }

  return dictionary[value] ?? { label: fallbackLabel ?? value, tone: 'neutral' };
}

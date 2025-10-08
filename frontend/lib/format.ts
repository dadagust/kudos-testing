const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

export function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (startDate.getFullYear() === endDate.getFullYear()) {
    const startFormatter = new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'long',
    });

    return `${startFormatter.format(startDate)} — ${dateFormatter.format(endDate)}`;
  }

  return `${dateFormatter.format(startDate)} — ${dateFormatter.format(endDate)}`;
}

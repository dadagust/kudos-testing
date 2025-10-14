'use client';

import { useMemo } from 'react';

import { useAuth } from '@/features/auth';
import { PermissionScope } from '@/shared/config/permissions';
import { ADMIN_SECTIONS, ROLE_TITLES } from '@/shared/config/roles';
import { Table, Tag } from '@/shared/ui';

const sectionsLabels: Record<(typeof ADMIN_SECTIONS)[number], string> = {
  dashboard: 'Дашборд',
  products: 'Товары',
  orders: 'Заказы',
  customers: 'Клиенты',
  inventory: 'Склад',
  documents: 'Документы',
  integrations: 'Интеграции',
  settings: 'Настройки',
  logs: 'Логи',
};

const domainScopes: Array<{ scope: PermissionScope; label: string }> = [
  { scope: 'customers', label: 'Клиенты' },
  { scope: 'orders', label: 'Заказы' },
  { scope: 'inventory', label: 'Склад' },
  { scope: 'documents', label: 'Документы' },
];

export default function ProfilePage() {
  const { user } = useAuth();
  const adminRows = useMemo(
    () =>
      ADMIN_SECTIONS.map((section) => {
        const scope = `admin_${section}` as PermissionScope;
        const flags = user?.permissions?.[scope];
        return {
          id: scope,
          label: sectionsLabels[section],
          view: Boolean(flags?.view),
          change: Boolean(flags?.change),
        };
      }),
    [user]
  );

  const domainRows = useMemo(
    () =>
      domainScopes.map(({ scope, label }) => {
        const flags = user?.permissions?.[scope];
        return {
          id: scope,
          label,
          view: Boolean(flags?.view),
          change: Boolean(flags?.change),
        };
      }),
    [user]
  );

  const columns = useMemo(
    () => [
      {
        key: 'label',
        header: 'Раздел',
        render: (row: { label: string }) => <strong>{row.label}</strong>,
      },
      {
        key: 'view',
        header: 'Просмотр',
        render: (row: { view: boolean }) => <Tag>{row.view ? 'Да' : 'Нет'}</Tag>,
      },
      {
        key: 'change',
        header: 'Изменение',
        render: (row: { change: boolean }) => <Tag tone={row.change ? 'success' : 'default'}>{row.change ? 'Да' : 'Нет'}</Tag>,
      },
    ],
    []
  );

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1>Профиль</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Вы авторизованы как <strong>{user?.full_name}</strong> ({user?.email}). Текущая роль —{' '}
          {user ? ROLE_TITLES[user.role] : '—'}.
        </p>
      </div>
      <div>
        <h2>Доступ к разделам кабинета</h2>
        <Table columns={columns} data={adminRows} />
      </div>
      <div>
        <h2>Права на основные сущности</h2>
        <Table columns={columns} data={domainRows} />
      </div>
    </section>
  );
}

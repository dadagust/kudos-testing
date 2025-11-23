'use client';

import { useMemo } from 'react';

import { useAuth } from '@/features/auth';
import { hasPermission } from '@/shared/config/permissions';
import { ADMIN_SECTIONS, ROLE_TITLES } from '@/shared/config/roles';
import { Table, Tag } from '@/shared/ui';

const sectionsLabels: Record<(typeof ADMIN_SECTIONS)[number], string> = {
  dashboard: 'Дашборд',
  products: 'Прайс-лист',
  orders: 'Заказы',
  logistics: 'Логистика',
  customers: 'Клиенты',
  inventory: 'Склад',
  logs: 'Логи',
};

const domainPermissions = [
  {
    label: 'Клиенты',
    view: 'customers_view_customer',
    change: 'customers_change_customer',
  },
  { label: 'Заказы', view: 'orders_view_order', change: 'orders_change_order' },
  {
    label: 'Склад',
    view: 'inventory_view_inventoryitem',
    change: 'inventory_change_inventoryitem',
  },
  { label: 'Документы', view: 'documents_view_document', change: 'documents_change_document' },
];

export default function ProfilePage() {
  const { user } = useAuth();
  const adminRows = useMemo(
    () =>
      ADMIN_SECTIONS.map((section) => {
        const view = `adminpanel_view_${section}`;
        const change = `adminpanel_change_${section}`;
        return {
          id: section,
          label: sectionsLabels[section],
          view: hasPermission(user?.permissions, view),
          change: hasPermission(user?.permissions, change),
        };
      }),
    [user]
  );

  const domainRows = useMemo(
    () =>
      domainPermissions.map(({ label, view, change }) => ({
        id: label,
        label,
        view: hasPermission(user?.permissions, view),
        change: hasPermission(user?.permissions, change),
      })),
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
        render: (row: { change: boolean }) => (
          <Tag tone={row.change ? 'success' : 'default'}>{row.change ? 'Да' : 'Нет'}</Tag>
        ),
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

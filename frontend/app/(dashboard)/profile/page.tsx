'use client';

import { useMemo } from 'react';

import { useAuth } from '@/features/auth';
import {
  ADMIN_SECTIONS,
  ROLE_DESCRIPTIONS,
  ROLE_SECTION_ACCESS,
  ROLE_TITLES,
  Role,
} from '@/shared/config/roles';
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

type MatrixRow = {
  role: Role;
  label: string;
  access: Set<string>;
};

export default function ProfilePage() {
  const { user } = useAuth();
  const matrix = useMemo<MatrixRow[]>(
    () =>
      Object.entries(ROLE_SECTION_ACCESS).map(([role, access]) => ({
        role: role as Role,
        label: ROLE_DESCRIPTIONS[role as Role],
        access: new Set(access),
      })),
    []
  );

  const columns = useMemo(
    () => [
      {
        key: 'role',
        header: 'Роль',
        render: (row: MatrixRow) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <strong>{ROLE_TITLES[row.role]}</strong>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{row.label}</span>
          </div>
        ),
      },
      ...ADMIN_SECTIONS.map((section) => ({
        key: section,
        header: sectionsLabels[section],
        render: (row: MatrixRow) => <Tag>{row.access.has(section) ? 'Доступно' : 'Скрыто'}</Tag>,
      })),
    ],
    []
  );

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1>Профиль</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Вы авторизованы как <strong>{user?.fullName}</strong> ({user?.email}). Текущая роль —{' '}
          {user?.role}.
        </p>
      </div>
      <div>
        <h2>Матрица доступов</h2>
        <Table columns={columns} data={matrix} />
      </div>
    </section>
  );
}

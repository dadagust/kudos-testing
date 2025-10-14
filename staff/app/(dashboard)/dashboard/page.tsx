'use client';

import { useMemo } from 'react';

import { useAuth } from '@/features/auth';
import { Badge, Pagination, Table, Tag } from '@/shared/ui';

const stats = [
  { title: 'Активных заказов', value: 42, trend: '+12% за неделю' },
  { title: 'Готовится к выдаче', value: 18, trend: '+5% за неделю' },
  { title: 'Просроченных задач', value: 3, trend: '−2% за неделю' },
];

const orders = [
  {
    id: 'ORD-1024',
    customer: 'EventLab',
    status: 'В резерве',
    amount: '94 500 ₽',
    date: '12.10.2025',
  },
  {
    id: 'ORD-1023',
    customer: 'ArtPeople',
    status: 'Комплектуется',
    amount: '52 300 ₽',
    date: '11.10.2025',
  },
  {
    id: 'ORD-1022',
    customer: 'Kudos Studio',
    status: 'Оплачено',
    amount: '74 900 ₽',
    date: '10.10.2025',
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const columns = useMemo(
    () => [
      { key: 'id', header: 'Заказ' },
      { key: 'customer', header: 'Клиент' },
      {
        key: 'status',
        header: 'Статус',
        render: (row: (typeof orders)[number]) => <Badge tone="info">{row.status}</Badge>,
      },
      { key: 'amount', header: 'Сумма' },
      { key: 'date', header: 'Дата' },
    ],
    []
  );

  return (
    <>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '24px',
        }}
      >
        {stats.map((item) => (
          <article
            key={item.title}
            style={{
              background: 'var(--color-surface)',
              borderRadius: '20px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)',
            }}
          >
            <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>{item.title}</span>
            <strong style={{ fontSize: '32px' }}>{item.value}</strong>
            <Tag>{item.trend}</Tag>
          </article>
        ))}
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        <div>
          <h3>Последние заказы</h3>
          <Table columns={columns} data={orders} />
          <Pagination page={1} pages={5} onChange={() => {}} />
        </div>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3>Моя роль</h3>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Вы вошли как <strong>{user?.fullName}</strong>. Текущая роль —{' '}
            <strong>{user?.role}</strong>. Используйте страницу «Профиль» для просмотра матрицы
            доступов.
          </p>
        </aside>
      </section>
    </>
  );
}

'use client';

import { useState } from 'react';

import { RoleGuard } from '@/features/auth';
import { Role } from '@/shared/config/roles';
import { Badge, Button, Drawer, Table } from '@/shared/ui';

const orders = [
  {
    id: 'ORD-1024',
    customer: 'EventLab',
    status: 'В резерве',
    amount: '94 500 ₽',
    manager: 'И. Сафонова',
  },
  {
    id: 'ORD-1023',
    customer: 'ArtPeople',
    status: 'Комплектуется',
    amount: '52 300 ₽',
    manager: 'А. Кузнецова',
  },
  {
    id: 'ORD-1022',
    customer: 'Kudos Studio',
    status: 'Оплачено',
    amount: '74 900 ₽',
    manager: 'В. Смирнов',
  },
];

export default function OrdersPage() {
  const [selected, setSelected] = useState<(typeof orders)[number] | null>(null);

  return (
    <RoleGuard allow={[Role.SalesManager, Role.Warehouse, Role.Accountant, Role.Admin]}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Заказы</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Канбан и календарь появятся во 2-й итерации.
          </p>
        </div>
        <Button iconLeft="filter">Фильтры</Button>
      </header>
      <Table
        columns={[
          { key: 'id', header: 'Номер' },
          { key: 'customer', header: 'Клиент' },
          {
            key: 'status',
            header: 'Статус',
            render: (row: (typeof orders)[number]) => <Badge tone="info">{row.status}</Badge>,
          },
          { key: 'amount', header: 'Сумма' },
          { key: 'manager', header: 'Менеджер' },
          {
            key: 'actions',
            header: '',
            render: (row: (typeof orders)[number]) => (
              <Button variant="ghost" onClick={() => setSelected(row)}>
                Подробнее
              </Button>
            ),
          },
        ]}
        data={orders}
      />
      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)}>
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3>{selected.id}</h3>
            <p>
              Клиент: <strong>{selected.customer}</strong>
            </p>
            <p>
              Статус: <Badge tone="info">{selected.status}</Badge>
            </p>
            <p>Сумма: {selected.amount}</p>
            <p>Ответственный: {selected.manager}</p>
            <Button>Перейти в карточку</Button>
          </div>
        ) : null}
      </Drawer>
    </RoleGuard>
  );
}

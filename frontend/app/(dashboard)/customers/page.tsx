'use client';

import { RoleGuard } from '@/features/auth';
import { Role } from '@/shared/config/roles';
import { Button, Table } from '@/shared/ui';

const customers = [
  { name: 'EventLab', type: 'B2B', orders: 24, balance: '120 000 ₽' },
  { name: 'ArtPeople', type: 'B2B', orders: 18, balance: '58 400 ₽' },
  { name: 'Иванова Мария', type: 'Клиент', orders: 6, balance: '0 ₽' },
];

export default function CustomersPage() {
  return (
    <RoleGuard allow={[Role.SalesManager, Role.Accountant, Role.Admin]}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Клиентская база</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Здесь появятся фильтры по типам клиентов и статусам.
          </p>
        </div>
        <Button iconLeft="plus">Добавить клиента</Button>
      </header>
      <Table
        columns={[
          { key: 'name', header: 'Имя' },
          { key: 'type', header: 'Тип' },
          { key: 'orders', header: 'Заказы' },
          { key: 'balance', header: 'Баланс' },
        ]}
        data={customers}
      />
    </RoleGuard>
  );
}

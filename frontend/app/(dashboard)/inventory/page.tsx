'use client';

import { RoleGuard } from '@/features/auth';
import { Role } from '@/shared/config/roles';
import { Badge, Table } from '@/shared/ui';

const inventory = [
  { id: 'SKU-100', name: 'Подушка Velvet', location: 'Склад Юг', reserved: 12, available: 58 },
  {
    id: 'SKU-220',
    name: 'Подсвечник латунь',
    location: 'Склад Центр',
    reserved: 5,
    available: 120,
  },
  { id: 'SKU-330', name: 'Чаша стеклянная', location: 'Склад Юг', reserved: 0, available: 230 },
];

export default function InventoryPage() {
  return (
    <RoleGuard allow={[Role.SalesManager, Role.Warehouse, Role.Admin]}>
      <h1>Склад</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '16px' }}>
        На второй неделе сюда добавим календарь сборки и бронирования.
      </p>
      <Table
        columns={[
          { key: 'id', header: 'Артикул' },
          { key: 'name', header: 'Позиция' },
          { key: 'location', header: 'Локация' },
          {
            key: 'reserved',
            header: 'В резерве',
            render: (row: (typeof inventory)[number]) => (
              <Badge tone={row.reserved > 0 ? 'warning' : 'success'}>{row.reserved}</Badge>
            ),
          },
          { key: 'available', header: 'Доступно' },
        ]}
        data={inventory}
      />
    </RoleGuard>
  );
}

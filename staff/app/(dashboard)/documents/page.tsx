'use client';

import { RoleGuard } from '@/features/auth';
import { Button, Table } from '@/shared/ui';

const documents = [
  {
    id: 'DOC-550',
    order: 'ORD-1024',
    type: 'Счет на оплату',
    status: 'Готов',
    updatedAt: '12.10.2025',
  },
  {
    id: 'DOC-551',
    order: 'ORD-1023',
    type: 'Акт приема-передачи',
    status: 'Черновик',
    updatedAt: '11.10.2025',
  },
];

export default function DocumentsPage() {
  return (
    <RoleGuard allow={[{ scope: 'admin_documents' }, { scope: 'documents' }]}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Документы</h1>
        <Button iconLeft="upload">Загрузить</Button>
      </header>
      <Table
        columns={[
          { key: 'id', header: 'Документ' },
          { key: 'order', header: 'Заказ' },
          { key: 'type', header: 'Тип' },
          { key: 'status', header: 'Статус' },
          { key: 'updatedAt', header: 'Обновлен' },
        ]}
        data={documents}
      />
    </RoleGuard>
  );
}

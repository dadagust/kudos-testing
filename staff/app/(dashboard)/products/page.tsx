'use client';

import { RoleGuard } from '@/features/auth';
import { Role } from '@/shared/config/roles';
import { Button, Table, Tag } from '@/shared/ui';

const products = [
  { sku: 'CHAIR-001', name: 'Стул Tiffany золото', category: 'Мебель', stock: 64, price: '450 ₽' },
  {
    sku: 'TABLE-009',
    name: 'Стол банкетный 180 см',
    category: 'Мебель',
    stock: 24,
    price: '1 200 ₽',
  },
  {
    sku: 'TEXT-044',
    name: 'Скатерть бархат синяя',
    category: 'Текстиль',
    stock: 80,
    price: '390 ₽',
  },
];

export default function ProductsPage() {
  return (
    <RoleGuard allow={[Role.Manager, Role.ContentManager, Role.Administrator]}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Каталог товаров</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Моки данных до интеграции с основным API.
          </p>
        </div>
        <Button iconLeft="plus">Новый товар</Button>
      </header>
      <Table
        columns={[
          { key: 'sku', header: 'Артикул' },
          { key: 'name', header: 'Название' },
          { key: 'category', header: 'Категория' },
          {
            key: 'stock',
            header: 'Доступно',
            render: (row: (typeof products)[number]) => <Tag>{row.stock} шт</Tag>,
          },
          { key: 'price', header: 'Цена/сутки' },
        ]}
        data={products}
      />
    </RoleGuard>
  );
}

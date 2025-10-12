'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useCustomers } from '@/entities/customer';
import { RoleGuard } from '@/features/auth';
import { Role } from '@/shared/config/roles';
import { Badge, Button, Input, Pagination, Spinner, Table, Tag } from '@/shared/ui';

const PAGE_SIZE = 10;

const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  individual: 'Физ. лицо',
  corporate: 'B2B',
};

export default function CustomersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handler);
  }, [search]);

  const query = useMemo(
    () => ({ page, page_size: PAGE_SIZE, q: debouncedSearch || undefined }),
    [page, debouncedSearch]
  );

  const { data, isLoading, isError, error } = useCustomers(query);

  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;

  const handleOpenDetails = (id: number) => {
    router.push(`/customers/${id}`);
  };

  return (
    <RoleGuard allow={[Role.SalesManager, Role.Accountant, Role.Admin]}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h1>Клиентская база</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Управляйте профилями клиентов, контактами и компаниями.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ minWidth: '280px' }}>
            <Input
              placeholder="Поиск по имени, email или телефону"
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
            />
          </div>
          <Button iconLeft="plus">Добавить клиента</Button>
        </div>
      </header>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Spinner />
        </div>
      ) : null}

      {isError ? (
        <div style={{ color: 'var(--color-text-danger)', marginTop: '24px' }}>
          Не удалось загрузить список клиентов. {error?.message}
        </div>
      ) : null}

      {!isLoading && data ? (
        <>
          <Table
            data={data.results}
            emptyMessage="Клиенты ещё не добавлены."
            columns={[
              {
                key: 'full_name',
                header: 'Имя',
                render: (row) => (
                  <button
                    type="button"
                    onClick={() => handleOpenDetails(row.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {row.full_name || row.email}
                  </button>
                ),
              },
              {
                key: 'email',
                header: 'E-mail',
              },
              {
                key: 'phone',
                header: 'Телефон',
              },
              {
                key: 'customer_type',
                header: 'Тип',
                render: (row) => CUSTOMER_TYPE_LABEL[row.customer_type] ?? row.customer_type,
              },
              {
                key: 'tags',
                header: 'Теги',
                render: (row) =>
                  row.tags.length ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {row.tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                  ),
              },
              {
                key: 'company',
                header: 'Компания',
                render: (row) =>
                  row.company?.name ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>,
              },
              {
                key: 'created_at',
                header: 'Создан',
                render: (row) =>
                  new Date(row.created_at).toLocaleDateString('ru-RU', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  }),
              },
              {
                key: 'actions',
                header: '',
                render: (row) => (
                  <Button variant="ghost" onClick={() => handleOpenDetails(row.id)}>
                    Открыть
                  </Button>
                ),
              },
            ]}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '16px',
            }}
          >
            <Badge tone="info">Всего клиентов: {data.count}</Badge>
            <Pagination page={page} pages={totalPages} onChange={setPage} />
          </div>
        </>
      ) : null}

      {!isLoading && !data && !isError ? (
        <div style={{ marginTop: '24px', color: 'var(--color-text-muted)' }}>
          Нет данных для отображения.
        </div>
      ) : null}

      <div style={{ marginTop: '24px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
        Полная карточка клиента доступна по ссылке{' '}
        <Link href="/customers/1" style={{ color: 'var(--color-primary)' }}>
          /customers/&lt;id&gt;
        </Link>
        .
      </div>
    </RoleGuard>
  );
}

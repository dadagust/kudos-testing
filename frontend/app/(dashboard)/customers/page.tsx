'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ChangeEvent, FormEvent, useMemo, useState } from 'react';

import {
  CUSTOMER_TYPE_LABELS,
  CreateCustomerPayload,
  CustomerSummary,
  useCreateCustomerMutation,
  useCustomersQuery,
} from '@/entities/customer';
import { RoleGuard } from '@/features/auth';
import { Role } from '@/shared/config/roles';
import { Alert, Button, Drawer, Input, Pagination, Select, Spinner, Table, Tag } from '@/shared/ui';
import type { TableColumn } from '@/shared/ui';

const DEFAULT_PAGE_SIZE = 10;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

const normalizeValue = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const initialFormState: CreateCustomerPayload & { tagsInput: string } = {
  customer_type: 'personal',
  first_name: '',
  last_name: '',
  middle_name: '',
  display_name: '',
  email: '',
  phone: '',
  notes: '',
  tagsInput: '',
};

export default function CustomersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState('-created_at');
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(initialFormState);
  const [createError, setCreateError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const queryParams = useMemo(
    () => ({
      search: searchTerm || undefined,
      sort,
      page,
      page_size: DEFAULT_PAGE_SIZE,
    }),
    [page, searchTerm, sort]
  );

  const {
    data: customersResponse,
    isLoading,
    isError,
    error,
    isFetching,
  } = useCustomersQuery(queryParams);

  const rows: CustomerSummary[] = customersResponse?.data ?? [];
  const pagination = customersResponse?.meta?.pagination;

  const columns: TableColumn<CustomerSummary>[] = [
    {
      key: 'display_name',
      header: 'Клиент',
      render: (row) => {
        const displayName = row.display_name || row.full_name || 'Без имени';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Link
              href={`/customers/${row.id}`}
              style={{ fontWeight: 600, color: 'var(--color-primary)' }}
            >
              {displayName}
            </Link>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              {row.email || 'Email не указан'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'customer_type',
      header: 'Тип',
      render: (row) => CUSTOMER_TYPE_LABELS[row.customer_type] ?? row.customer_type,
    },
    {
      key: 'phone',
      header: 'Телефон',
      render: (row) => row.phone || '—',
    },
    {
      key: 'tags',
      header: 'Теги',
      render: (row) =>
        row.tags.length ? (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {row.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>Нет</span>
        ),
    },
    {
      key: 'updated_at',
      header: 'Обновлён',
      render: (row) => formatDateTime(row.updated_at),
    },
    {
      key: 'actions',
      header: ' ',
      render: (row) => (
        <Link href={`/customers/${row.id}`}>
          <Button variant="ghost" iconLeft="info">
            Подробнее
          </Button>
        </Link>
      ),
    },
  ];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchTerm(searchInput);
    setPage(1);
  };

  const handleReset = () => {
    setSearchInput('');
    setSearchTerm('');
    setSort('-created_at');
    setPage(1);
  };

  const handleSortChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSort(event.target.value);
    setPage(1);
  };

  const handleCreateFieldChange =
    (field: keyof typeof createForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setCreateForm((prev) => ({
        ...prev,
        [field]:
          field === 'customer_type' ? (value as CreateCustomerPayload['customer_type']) : value,
      }));
    };

  const createMutation = useCreateCustomerMutation();

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);

    const payload: CreateCustomerPayload = {
      customer_type: createForm.customer_type,
      first_name: normalizeValue(createForm.first_name ?? ''),
      last_name: normalizeValue(createForm.last_name ?? ''),
      middle_name: normalizeValue(createForm.middle_name ?? ''),
      display_name: normalizeValue(createForm.display_name ?? ''),
      email: normalizeValue(createForm.email ?? ''),
      phone: normalizeValue(createForm.phone ?? ''),
      notes: normalizeValue(createForm.notes ?? ''),
      gdpr_consent: true,
      tags: createForm.tagsInput
        ? createForm.tagsInput
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        : undefined,
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        setIsCreateOpen(false);
        setCreateForm(initialFormState);
        setSuccessMessage('Клиент успешно создан. Список обновлён.');
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      },
      onError: (mutationError) => {
        setCreateError(
          mutationError instanceof Error
            ? mutationError.message
            : 'Не удалось создать клиента. Попробуйте снова.'
        );
      },
    });
  };

  const closeCreateDrawer = () => {
    setIsCreateOpen(false);
    setCreateError(null);
  };

  return (
    <RoleGuard allow={[Role.SalesManager, Role.Accountant, Role.Admin]}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h1>Клиентская база</h1>
            <p style={{ color: 'var(--color-text-muted)', maxWidth: '48rem' }}>
              Управляйте клиентами: ищите по имени, фильтруйте по дате создания и открывайте
              карточку клиента для детальной информации.
            </p>
          </div>
          <Button iconLeft="plus" onClick={() => setIsCreateOpen(true)}>
            Добавить клиента
          </Button>
        </header>

        {successMessage ? (
          <Alert tone="success" title="Готово">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span>{successMessage}</span>
              <Button variant="ghost" type="button" onClick={() => setSuccessMessage(null)}>
                Скрыть
              </Button>
            </div>
          </Alert>
        ) : null}

        <section
          style={{
            marginTop: '8px',
            padding: '20px',
            borderRadius: '16px',
            background: 'var(--color-surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              alignItems: 'end',
            }}
          >
            <Input
              label="Поиск"
              placeholder="Имя, email или телефон"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Select label="Сортировка" value={sort} onChange={handleSortChange}>
              <option value="-created_at">Сначала новые</option>
              <option value="created_at">Сначала старые</option>
              <option value="name">По имени A→Я</option>
              <option value="-name">По имени Я→A</option>
            </Select>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button type="submit" iconLeft="search">
                Найти
              </Button>
              <Button type="button" variant="ghost" onClick={handleReset}>
                Сбросить
              </Button>
            </div>
          </form>
        </section>

        {isLoading ? <Spinner label="Загружаем клиентов" /> : null}

        {isError ? (
          <Alert tone="danger" title="Не удалось получить список клиентов">
            {error instanceof Error
              ? error.message
              : 'Попробуйте обновить страницу или повторить позже.'}
          </Alert>
        ) : null}

        {!isLoading && !isError ? (
          <Table
            columns={columns}
            data={rows}
            emptyMessage={
              searchTerm ? 'По запросу ничего не найдено.' : 'Клиенты пока не добавлены.'
            }
          />
        ) : null}

        {isFetching && !isLoading ? <Spinner label="Обновляем данные…" /> : null}

        {pagination ? (
          <Pagination page={pagination.page} pages={pagination.total_pages} onChange={setPage} />
        ) : null}
      </div>

      <Drawer open={isCreateOpen} onClose={closeCreateDrawer}>
        <form
          onSubmit={handleCreateSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '24px',
            minWidth: '360px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h2 style={{ fontSize: '1.25rem' }}>Новый клиент</h2>
            <p style={{ color: 'var(--color-text-muted)' }}>
              Заполните основную информацию. Остальные поля можно будет отредактировать позже в
              карточке клиента.
            </p>
          </div>

          {createError ? (
            <Alert tone="danger" title="Ошибка">
              {createError}
            </Alert>
          ) : null}

          <Select
            label="Тип клиента"
            value={createForm.customer_type}
            onChange={handleCreateFieldChange('customer_type')}
          >
            <option value="personal">Физическое лицо</option>
            <option value="business">Юридическое лицо</option>
          </Select>

          <Input
            label="Имя"
            value={createForm.first_name ?? ''}
            onChange={handleCreateFieldChange('first_name')}
          />
          <Input
            label="Фамилия"
            value={createForm.last_name ?? ''}
            onChange={handleCreateFieldChange('last_name')}
          />
          <Input
            label="Отчество"
            value={createForm.middle_name ?? ''}
            onChange={handleCreateFieldChange('middle_name')}
          />
          <Input
            label="Отображаемое имя"
            helperText="Если оставить пустым, будет использовано полное имя"
            value={createForm.display_name ?? ''}
            onChange={handleCreateFieldChange('display_name')}
          />
          <Input
            label="Email"
            type="email"
            value={createForm.email ?? ''}
            onChange={handleCreateFieldChange('email')}
          />
          <Input
            label="Телефон"
            value={createForm.phone ?? ''}
            onChange={handleCreateFieldChange('phone')}
          />
          <Input
            label="Теги"
            helperText="Через запятую"
            value={createForm.tagsInput}
            onChange={handleCreateFieldChange('tagsInput')}
          />
          <Input
            label="Заметки"
            value={createForm.notes ?? ''}
            onChange={handleCreateFieldChange('notes')}
          />

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <Button type="submit" iconLeft="check" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Сохраняем…' : 'Создать клиента'}
            </Button>
            <Button type="button" variant="ghost" onClick={closeCreateDrawer}>
              Отмена
            </Button>
          </div>
        </form>
      </Drawer>
    </RoleGuard>
  );
}

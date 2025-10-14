'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ChangeEvent,
  Dispatch,
  FormEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CUSTOMER_TYPE_LABELS,
  CreateCustomerPayload,
  CustomerSummary,
  UpdateCustomerPayload,
  customersApi,
  useCreateCustomerMutation,
  useCustomerQuery,
  useCustomersQuery,
  useDeleteCustomerMutation,
  useUpdateCustomerMutation,
} from '@/entities/customer';
import { RoleGuard } from '@/features/auth';
import { formatPhoneDisplay, formatPhoneInput, normalizePhoneNumber } from '@/shared/lib/phone';
import {
  Alert,
  Button,
  Drawer,
  Input,
  Modal,
  Pagination,
  Select,
  Spinner,
  Table,
} from '@/shared/ui';
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

type CustomerFormState = CreateCustomerPayload & { gdpr_consent: boolean };

const baseFormState: CustomerFormState = {
  customer_type: 'personal',
  first_name: '',
  last_name: '',
  middle_name: '',
  display_name: '',
  email: '',
  phone: '',
  notes: '',
  gdpr_consent: true,
};

const createInitialFormState = (): CustomerFormState => ({ ...baseFormState });

const createFieldChangeHandler =
  (setter: Dispatch<SetStateAction<CustomerFormState>>) =>
  (field: keyof CustomerFormState) =>
  (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { value } = event.target;
    setter((prev) => ({
      ...prev,
      [field]:
        field === 'customer_type'
          ? (value as CreateCustomerPayload['customer_type'])
          : field === 'gdpr_consent'
            ? value === 'true'
            : value,
    }));
  };

const buildPayloadFromForm = (form: CustomerFormState): UpdateCustomerPayload => {
  return {
    customer_type: form.customer_type,
    first_name: normalizeValue(form.first_name ?? ''),
    last_name: normalizeValue(form.last_name ?? ''),
    middle_name: normalizeValue(form.middle_name ?? ''),
    display_name: normalizeValue(form.display_name ?? ''),
    email: normalizeValue(form.email ?? ''),
    phone: normalizePhoneNumber(form.phone),
    notes: normalizeValue(form.notes ?? ''),
    gdpr_consent: form.gdpr_consent,
  };
};

export default function CustomersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState('-created');
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CustomerFormState>(() => createInitialFormState());
  const [createError, setCreateError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CustomerFormState>(() => createInitialFormState());
  const [editError, setEditError] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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
    refetch,
  } = useCustomersQuery(queryParams);

  useEffect(() => {
    if (searchTerm === searchInput) {
      return;
    }

    setSearchTerm(searchInput);
    setPage(1);
  }, [searchInput, searchTerm]);

  const handleCreateFieldChange = createFieldChangeHandler(setCreateForm);
  const handleEditFieldChange = createFieldChangeHandler(setEditForm);

  const handleCreatePhoneChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(event.target.value);
    setCreateForm((prev) => ({
      ...prev,
      phone: formatted,
    }));
  }, []);

  const handleEditPhoneChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(event.target.value);
    setEditForm((prev) => ({
      ...prev,
      phone: formatted,
    }));
  }, []);

  const {
    data: editCustomerResponse,
    isLoading: isEditLoading,
    isError: isEditFetchError,
    error: editFetchError,
  } = useCustomerQuery(editCustomerId ?? '', isEditOpen && Boolean(editCustomerId));

  useEffect(() => {
    if (editCustomerResponse?.data) {
      const customer = editCustomerResponse.data;
      setEditForm({
        customer_type: customer.customer_type,
        first_name: customer.first_name ?? '',
        last_name: customer.last_name ?? '',
        middle_name: customer.middle_name ?? '',
        display_name: customer.display_name ?? '',
        email: customer.email ?? '',
        phone: formatPhoneInput(customer.phone ?? ''),
        notes: customer.notes ?? '',
        gdpr_consent: customer.gdpr_consent ?? false,
      });
    }
  }, [editCustomerResponse]);

  const handleOpenEdit = useCallback((customerId: string) => {
    setEditCustomerId(customerId);
    setEditError(null);
    setEditForm(createInitialFormState());
    setIsEditOpen(true);
  }, []);

  const rows: CustomerSummary[] = customersResponse?.data ?? [];
  const pagination = customersResponse?.meta?.pagination;

  const deleteMutation = useDeleteCustomerMutation();

  const handleOpenDelete = useCallback((customer: CustomerSummary) => {
    setCustomerToDelete(customer);
    setDeleteError(null);
    setIsDeleteOpen(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (deleteMutation.isPending) {
      return;
    }

    setIsDeleteOpen(false);
    setCustomerToDelete(null);
    setDeleteError(null);
  }, [deleteMutation.isPending]);

  const handleConfirmDelete = useCallback(() => {
    if (!customerToDelete) {
      return;
    }

    setDeleteError(null);

    const customerId = customerToDelete.id;

    deleteMutation.mutate(customerId, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setCustomerToDelete(null);
        setSuccessMessage('Клиент успешно удалён. Список обновлён.');
        void refetch();
      },
      onError: (mutationError) => {
        setDeleteError(
          mutationError instanceof Error
            ? mutationError.message
            : 'Не удалось удалить клиента. Попробуйте снова.'
        );
      },
    });
  }, [customerToDelete, deleteMutation, refetch]);

  const columns: TableColumn<CustomerSummary>[] = useMemo(
    () => [
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
        render: (row) => (row.phone ? formatPhoneDisplay(row.phone) : '—'),
      },
      {
        key: 'modified',
        header: 'Обновлён',
        render: (row) => formatDateTime(row.modified),
      },
      {
        key: 'actions',
        header: ' ',
        render: (row) => (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Link href={`/customers/${row.id}`}>
              <Button variant="ghost" iconLeft="info" type="button">
                Подробнее
              </Button>
            </Link>
            <RoleGuard section="customers" permission="change" fallback={null}>
              <Button variant="ghost" type="button" onClick={() => handleOpenEdit(row.id)}>
                Редактировать
              </Button>
            </RoleGuard>
            <RoleGuard section="customers" permission="change" fallback={null}>
              <Button
                variant="ghost"
                type="button"
                onClick={() => handleOpenDelete(row)}
                style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
              >
                Удалить
              </Button>
            </RoleGuard>
          </div>
        ),
      },
    ],
    [handleOpenDelete, handleOpenEdit]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setExportError(null);
    setSearchTerm(searchInput);
    setPage(1);
  };

  const handleReset = () => {
    setSearchInput('');
    setSearchTerm('');
    setSort('-created');
    setPage(1);
    setExportError(null);
  };

  const handleSortChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setExportError(null);
    setSort(event.target.value);
    setPage(1);
  };

  const createMutation = useCreateCustomerMutation();
  const updateMutation = useUpdateCustomerMutation();

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);

    const payload = buildPayloadFromForm(createForm);

    createMutation.mutate(payload, {
      onSuccess: () => {
        setIsCreateOpen(false);
        setCreateForm(createInitialFormState());
        setSuccessMessage('Клиент успешно создан. Список обновлён.');
        void refetch();
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

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const blob = await customersApi.export(queryParams);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      link.href = url;
      link.download = `customers-${timestamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setSuccessMessage('Файл с клиентами сформирован и загружается.');
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : 'Не удалось выгрузить клиентов. Попробуйте снова позже.'
      );
    } finally {
      setIsExporting(false);
    }
  }, [queryParams]);

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editCustomerId) {
      return;
    }

    setEditError(null);

    const payload = buildPayloadFromForm(editForm);
    const customerId = editCustomerId;

    updateMutation.mutate(
      { customerId, payload },
      {
        onSuccess: (response) => {
          queryClient.setQueryData(['customer', customerId], response);
          setIsEditOpen(false);
          setEditCustomerId(null);
          setEditForm(createInitialFormState());
          setSuccessMessage('Данные клиента обновлены. Список обновлён.');
          void refetch();
        },
        onError: (mutationError) => {
          setEditError(
            mutationError instanceof Error
              ? mutationError.message
              : 'Не удалось обновить клиента. Попробуйте снова.'
          );
        },
      }
    );
  };

  const closeEditDrawer = () => {
    setIsEditOpen(false);
    setEditCustomerId(null);
    setEditError(null);
    setEditForm(createInitialFormState());
  };

  return (
    <RoleGuard section="customers">
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
          <RoleGuard section="customers" permission="change" fallback={null}>
            <Button iconLeft="plus" onClick={() => setIsCreateOpen(true)}>
              Добавить клиента
            </Button>
          </RoleGuard>
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
        {exportError ? (
          <Alert tone="danger" title="Не удалось выгрузить клиентов">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span>{exportError}</span>
              <Button variant="ghost" type="button" onClick={() => setExportError(null)}>
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
              <option value="-created">Сначала новые</option>
              <option value="created">Сначала старые</option>
              <option value="name">По имени A→Я</option>
              <option value="-name">По имени Я→A</option>
            </Select>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button type="button" variant="ghost" onClick={handleReset}>
                Сбросить
              </Button>
              <Button
                type="button"
                variant="ghost"
                iconLeft="excel"
                onClick={handleExport}
                disabled={isExporting}
                style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
              >
                {isExporting ? 'Формируем…' : 'Экспорт в Excel'}
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

        <RoleGuard section="customers" permission="change" fallback={null}>
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
                onChange={handleCreatePhoneChange}
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
        <RoleGuard section="customers" permission="change" fallback={null}>
          <Drawer open={isEditOpen} onClose={closeEditDrawer}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '24px',
                minWidth: '360px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h2 style={{ fontSize: '1.25rem' }}>Редактирование клиента</h2>
                <p style={{ color: 'var(--color-text-muted)' }}>
                  Обновите сведения о клиенте. После сохранения изменения сразу отобразятся в таблице
                  и карточке клиента.
                </p>
              </div>

              {isEditFetchError ? (
                <Alert tone="danger" title="Не удалось загрузить клиента">
                  {editFetchError instanceof Error
                    ? editFetchError.message
                    : 'Попробуйте закрыть окно и повторить попытку позже.'}
                </Alert>
              ) : null}

              {isEditLoading ? <Spinner label="Загружаем данные клиента" /> : null}

              {!isEditLoading && !isEditFetchError && !editCustomerResponse?.data ? (
                <Alert tone="info" title="Клиент не найден">
                  Возможно, запись была удалена или у вас нет доступа к её редактированию.
                </Alert>
              ) : null}

              {!isEditLoading && !isEditFetchError && editCustomerResponse?.data ? (
                <form
                  onSubmit={handleEditSubmit}
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                  {editError ? (
                    <Alert tone="danger" title="Ошибка при сохранении">
                      {editError}
                    </Alert>
                  ) : null}

                  <Select
                    label="Тип клиента"
                    value={editForm.customer_type}
                    onChange={handleEditFieldChange('customer_type')}
                  >
                    <option value="personal">Физическое лицо</option>
                    <option value="business">Юридическое лицо</option>
                  </Select>

                  <Input
                    label="Имя"
                    value={editForm.first_name ?? ''}
                    onChange={handleEditFieldChange('first_name')}
                  />
                  <Input
                    label="Фамилия"
                    value={editForm.last_name ?? ''}
                    onChange={handleEditFieldChange('last_name')}
                  />
                  <Input
                    label="Отчество"
                    value={editForm.middle_name ?? ''}
                    onChange={handleEditFieldChange('middle_name')}
                  />
                  <Input
                    label="Отображаемое имя"
                    helperText="Если оставить пустым, будет использовано полное имя"
                    value={editForm.display_name ?? ''}
                    onChange={handleEditFieldChange('display_name')}
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={editForm.email ?? ''}
                    onChange={handleEditFieldChange('email')}
                  />
                  <Input
                    label="Телефон"
                    value={editForm.phone ?? ''}
                    onChange={handleEditPhoneChange}
                  />
                  <Select
                    label="GDPR согласие"
                    value={editForm.gdpr_consent ? 'true' : 'false'}
                    onChange={handleEditFieldChange('gdpr_consent')}
                  >
                    <option value="true">Согласие получено</option>
                    <option value="false">Согласие отсутствует</option>
                  </Select>
                  <Input
                    label="Заметки"
                    value={editForm.notes ?? ''}
                    onChange={handleEditFieldChange('notes')}
                  />

                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <Button type="submit" iconLeft="check" disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? 'Сохраняем…' : 'Сохранить изменения'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={closeEditDrawer}>
                      Отмена
                    </Button>
                  </div>
                </form>
              ) : null}
            </div>
          </Drawer>
        </RoleGuard>
        <RoleGuard section="customers" permission="change" fallback={null}>
          <Modal open={isDeleteOpen} onClose={closeDeleteModal} title="Удалить клиента?">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '24px',
                minWidth: '320px',
              }}
            >
              <p style={{ lineHeight: 1.5 }}>
                {`Вы уверены, что хотите удалить клиента "${
                  customerToDelete?.display_name || customerToDelete?.full_name || 'Без имени'
                }"? Это действие нельзя отменить.`}
              </p>
              {deleteError ? (
                <Alert tone="danger" title="Не удалось удалить клиента">
                  {deleteError}
                </Alert>
              ) : null}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeDeleteModal}
                  disabled={deleteMutation.isPending}
                >
                  Отмена
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleConfirmDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Удаляем…' : 'Удалить'}
                </Button>
              </div>
            </div>
          </Modal>
        </RoleGuard>
    </RoleGuard>
  );
}

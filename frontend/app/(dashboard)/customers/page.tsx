'use client';

import { FormEvent, useMemo, useState } from 'react';

import {
  CUSTOMER_TYPE_LABELS,
  CustomerListQuery,
  CustomerSummary,
  useCustomerDetailsQuery,
  useCustomersQuery,
  useCreateCustomerMutation,
} from '@/entities/customer';
import { RoleGuard } from '@/features/auth';
import { Role } from '@/shared/config/roles';
import {
  Alert,
  Badge,
  Button,
  Drawer,
  FormField,
  Input,
  Pagination,
  Select,
  Spinner,
  Table,
  Tag,
} from '@/shared/ui';
import type { TableColumn } from '@/shared/ui';

const DEFAULT_PAGE_SIZE = 10;

const formatDate = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(value));
  } catch (error) {
    return value;
  }
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value)
    );
  } catch (error) {
    return value;
  }
};

const defaultFormState = {
  customerType: 'personal' as const,
  displayName: '',
  firstName: '',
  lastName: '',
  middleName: '',
  email: '',
  phone: '',
  tags: '',
  notes: '',
  companyName: '',
  gdprConsent: false,
};

export default function CustomersPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formValues, setFormValues] = useState(defaultFormState);

  const queryParams = useMemo<CustomerListQuery>(
    () => ({
      page,
      page_size: DEFAULT_PAGE_SIZE,
      search: searchTerm || undefined,
      sort: '-created_at',
    }),
    [page, searchTerm]
  );

  const customersQuery = useCustomersQuery(queryParams);
  const listResponse = customersQuery.data;
  const rows = listResponse?.data ?? [];
  const pagination = listResponse?.meta?.pagination;

  const customerDetailsQuery = useCustomerDetailsQuery(selectedCustomerId);

  const createCustomerMutation = useCreateCustomerMutation();

  const columns: TableColumn<CustomerSummary>[] = useMemo(
    () => [
      {
        key: 'display_name',
        header: 'Имя',
        render: (row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <strong>{row.full_name || row.display_name || 'Без имени'}</strong>
            {row.email ? (
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                {row.email}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'customer_type',
        header: 'Тип',
        render: (row) => (
          <Badge tone={row.customer_type === 'business' ? 'info' : 'success'}>
            {CUSTOMER_TYPE_LABELS[row.customer_type]}
          </Badge>
        ),
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
          row.tags?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {row.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          ) : (
            '—'
          ),
      },
      {
        key: 'created_at',
        header: 'Создан',
        render: (row) => formatDate(row.created_at),
      },
      {
        key: 'actions',
        header: ' ',
        render: (row) => (
          <Button variant="ghost" iconLeft="info" onClick={() => setSelectedCustomerId(row.id)}>
            Открыть
          </Button>
        ),
      },
    ],
    []
  );

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSearchTerm('');
    setPage(1);
  };

  const handleCreateDrawerClose = () => {
    setIsCreateOpen(false);
    setFormValues(defaultFormState);
  };

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      customer_type: formValues.customerType,
      display_name: formValues.displayName || undefined,
      first_name: formValues.firstName || undefined,
      last_name: formValues.lastName || undefined,
      middle_name: formValues.middleName || undefined,
      email: formValues.email || undefined,
      phone: formValues.phone || undefined,
      notes: formValues.notes || undefined,
      tags: formValues.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
      gdpr_consent: formValues.gdprConsent,
      company: formValues.companyName ? { name: formValues.companyName } : undefined,
    };

    createCustomerMutation.mutate(payload, {
      onSuccess: (response) => {
        handleCreateDrawerClose();
        setSelectedCustomerId(response.data.id);
      },
    });
  };

  const createErrorMessage = useMemo(() => {
    if (!createCustomerMutation.error) {
      return '';
    }
    const responseData = createCustomerMutation.error.response?.data;
    if (responseData && typeof responseData === 'object') {
      const messages = Object.values(responseData)
        .flatMap((value) => {
          if (!value) {
            return [];
          }
          if (Array.isArray(value)) {
            return value;
          }
          return [value];
        })
        .map((value) => value?.toString().trim())
        .filter((value) => value);
      if (messages.length) {
        return messages.join(' ');
      }
    }
    return createCustomerMutation.error.message;
  }, [createCustomerMutation.error]);

  const activeCustomer = customerDetailsQuery.data?.data;

  const handleEmailClick = (email?: string | null) => {
    if (email) {
      window.location.href = `mailto:${email}`;
    }
  };

  const handlePhoneClick = (phone?: string | null) => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

  return (
    <RoleGuard allow={[Role.SalesManager, Role.Accountant, Role.Admin]}>
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
            Управляйте контактами клиентов, просматривайте карточки с адресами и контактами,
            создавайте новых клиентов прямо из списка.
          </p>
        </div>
        <Button iconLeft="plus" onClick={() => setIsCreateOpen(true)}>
          Добавить клиента
        </Button>
      </header>

      <section
        style={{
          marginTop: '24px',
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--color-surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 1fr) auto auto',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <Input
            label="Поиск"
            placeholder="Имя, email или телефон"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <Button type="submit" iconLeft="search" disabled={customersQuery.isFetching}>
            Найти
          </Button>
          <Button type="button" variant="ghost" onClick={handleResetFilters}>
            Сбросить
          </Button>
        </form>

        {customersQuery.isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <Spinner label="Загружаем клиентов" />
          </div>
        ) : null}

        {customersQuery.isError ? (
          <Alert tone="danger" title="Не удалось загрузить клиентов">
            {customersQuery.error.message}
          </Alert>
        ) : null}

        {!customersQuery.isLoading && !customersQuery.isError ? (
          <>
            <Table
              columns={columns}
              data={rows}
              emptyMessage={
                searchTerm ? 'По запросу ничего не найдено.' : 'Список клиентов пока пуст.'
              }
            />
            {pagination ? (
              <Pagination
                page={pagination.page}
                pages={pagination.total_pages}
                onChange={setPage}
              />
            ) : null}
          </>
        ) : null}
      </section>

      <Drawer open={isCreateOpen} onClose={handleCreateDrawerClose}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2>Новый клиент</h2>
              <p style={{ color: 'var(--color-text-muted)' }}>
                Укажите контактные данные, чтобы менеджеры смогли быстро работать с клиентом.
              </p>
            </div>
            <Button variant="ghost" onClick={handleCreateDrawerClose}>
              Закрыть
            </Button>
          </div>
          <form
            onSubmit={handleCreateSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <Select
              label="Тип клиента"
              value={formValues.customerType}
              onChange={(event) =>
                setFormValues((prev) => ({
                  ...prev,
                  customerType: event.target.value as typeof prev.customerType,
                }))
              }
            >
              <option value="personal">{CUSTOMER_TYPE_LABELS.personal}</option>
              <option value="business">{CUSTOMER_TYPE_LABELS.business}</option>
            </Select>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
              }}
            >
              <Input
                label="Отображаемое имя"
                placeholder="Как будет видно в таблице"
                value={formValues.displayName}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, displayName: event.target.value }))
                }
              />
              <Input
                label="Имя"
                value={formValues.firstName}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, firstName: event.target.value }))
                }
              />
              <Input
                label="Фамилия"
                value={formValues.lastName}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, lastName: event.target.value }))
                }
              />
              <Input
                label="Отчество"
                value={formValues.middleName}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, middleName: event.target.value }))
                }
              />
              <Input
                label="Email"
                type="email"
                placeholder="client@example.com"
                value={formValues.email}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, email: event.target.value }))
                }
              />
              <Input
                label="Телефон"
                placeholder="+7 999 123-45-67"
                value={formValues.phone}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
              <Input
                label="Компания"
                placeholder="Если это корпоративный клиент"
                value={formValues.companyName}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, companyName: event.target.value }))
                }
              />
              <Input
                label="Теги"
                placeholder="Через запятую: vip, важно"
                value={formValues.tags}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, tags: event.target.value }))
                }
              />
            </div>
            <FormField label="Заметки для менеджеров">
              <textarea
                value={formValues.notes}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, notes: event.target.value }))
                }
                style={{
                  minHeight: '120px',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border)',
                  resize: 'vertical',
                  font: 'inherit',
                }}
                placeholder="Расскажите о предпочтениях клиента или договоренностях"
              />
            </FormField>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={formValues.gdprConsent}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, gdprConsent: event.target.checked }))
                }
              />
              <span>Получено согласие на обработку персональных данных</span>
            </label>
            {createCustomerMutation.isError ? (
              <Alert tone="danger" title="Не удалось создать клиента">
                {createErrorMessage}
              </Alert>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <Button type="button" variant="ghost" onClick={handleCreateDrawerClose}>
                Отмена
              </Button>
              <Button type="submit" disabled={createCustomerMutation.isPending} iconLeft="check">
                {createCustomerMutation.isPending ? 'Сохраняем…' : 'Сохранить'}
              </Button>
            </div>
          </form>
        </div>
      </Drawer>

      <Drawer open={Boolean(selectedCustomerId)} onClose={() => setSelectedCustomerId(null)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '360px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2>{activeCustomer?.full_name || 'Карточка клиента'}</h2>
              {activeCustomer?.created_at ? (
                <p style={{ color: 'var(--color-text-muted)' }}>
                  Клиент создан {formatDateTime(activeCustomer.created_at)}
                </p>
              ) : null}
            </div>
            <Button variant="ghost" onClick={() => setSelectedCustomerId(null)}>
              Закрыть
            </Button>
          </div>

          {customerDetailsQuery.isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
              <Spinner label="Загружаем карточку" />
            </div>
          ) : null}

          {customerDetailsQuery.isError ? (
            <Alert tone="danger" title="Не удалось загрузить данные клиента">
              {customerDetailsQuery.error.message}
            </Alert>
          ) : null}

          {activeCustomer ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <section
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '12px',
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'var(--color-layer-1)',
                }}
              >
                <div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                    Тип клиента
                  </span>
                  <div>
                    <Badge tone={activeCustomer.customer_type === 'business' ? 'info' : 'success'}>
                      {CUSTOMER_TYPE_LABELS[activeCustomer.customer_type]}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                    Email
                  </span>
                  <div>{activeCustomer.email || '—'}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                    Телефон
                  </span>
                  <div>{activeCustomer.phone || '—'}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                    Компания
                  </span>
                  <div>{activeCustomer.company?.name || '—'}</div>
                </div>
              </section>

              {activeCustomer.tags?.length ? (
                <section
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  {activeCustomer.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </section>
              ) : null}

              {activeCustomer.notes ? (
                <section
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'var(--color-layer-1)',
                  }}
                >
                  <h3 style={{ margin: 0, marginBottom: '8px' }}>Заметки</h3>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{activeCustomer.notes}</p>
                </section>
              ) : null}

              <section style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Button
                  variant="ghost"
                  iconLeft="mail"
                  onClick={() => handleEmailClick(activeCustomer.email)}
                  disabled={!activeCustomer.email}
                >
                  Написать письмо
                </Button>
                <Button
                  variant="ghost"
                  iconLeft="phone"
                  onClick={() => handlePhoneClick(activeCustomer.phone)}
                  disabled={!activeCustomer.phone}
                >
                  Позвонить
                </Button>
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ margin: 0 }}>Контакты</h3>
                {activeCustomer.contacts.length ? (
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {activeCustomer.contacts.map((contact) => (
                      <li
                        key={contact.id}
                        style={{
                          padding: '12px',
                          borderRadius: '12px',
                          background: 'var(--color-layer-1)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <strong>
                          {[contact.last_name, contact.first_name].filter(Boolean).join(' ') ||
                            'Контакт без имени'}
                        </strong>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                          {contact.position || '—'}
                        </span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <Button
                            variant="ghost"
                            iconLeft="mail"
                            onClick={() => handleEmailClick(contact.email)}
                            disabled={!contact.email}
                          >
                            {contact.email || 'Нет email'}
                          </Button>
                          <Button
                            variant="ghost"
                            iconLeft="phone"
                            onClick={() => handlePhoneClick(contact.phone)}
                            disabled={!contact.phone}
                          >
                            {contact.phone || 'Нет телефона'}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: 'var(--color-text-muted)' }}>
                    Пока нет добавленных контактов.
                  </p>
                )}
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ margin: 0 }}>Адреса</h3>
                {activeCustomer.addresses.length ? (
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {activeCustomer.addresses.map((address) => (
                      <li
                        key={address.id}
                        style={{
                          padding: '12px',
                          borderRadius: '12px',
                          background: 'var(--color-layer-1)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <strong>{address.title || 'Адрес'}</strong>
                        <span>
                          {[address.postal_code, address.region, address.city, address.line1]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </span>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                          {address.address_type === 'shipping'
                            ? 'Адрес доставки'
                            : address.address_type === 'billing'
                              ? 'Платёжный адрес'
                              : 'Другой адрес'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: 'var(--color-text-muted)' }}>Адреса пока не добавлены.</p>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </Drawer>
    </RoleGuard>
  );
}

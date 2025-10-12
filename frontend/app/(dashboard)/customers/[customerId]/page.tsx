'use client';

import { useRouter } from 'next/navigation';

import { CUSTOMER_TYPE_LABELS, CustomerDetail, useCustomerQuery } from '@/entities/customer';
import { RoleGuard } from '@/features/auth';
import { Role } from '@/shared/config/roles';
import { Alert, Badge, Button, Spinner, Tag } from '@/shared/ui';

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

interface CustomerDetailsPageProps {
  params: { customerId: string };
}

const getDisplayName = (customer: CustomerDetail) => {
  if (customer.display_name) {
    return customer.display_name;
  }
  if (customer.full_name) {
    return customer.full_name;
  }
  const parts = [customer.last_name, customer.first_name, customer.middle_name].filter(Boolean);
  return parts.join(' ') || 'Без имени';
};

export default function CustomerDetailsPage({ params }: CustomerDetailsPageProps) {
  const router = useRouter();
  const { data, isLoading, isError, error } = useCustomerQuery(params.customerId);
  const customer = data?.data;

  return (
    <RoleGuard allow={[Role.SalesManager, Role.Accountant, Role.Admin]}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button variant="ghost" onClick={() => router.back()}>
            ← Назад к списку
          </Button>
          {customer ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Tag>{CUSTOMER_TYPE_LABELS[customer.customer_type]}</Tag>
              <Badge tone={customer.gdpr_consent ? 'success' : 'warning'}>
                {customer.gdpr_consent ? 'GDPR согласие получено' : 'Нет согласия GDPR'}
              </Badge>
            </div>
          ) : null}
        </div>

        {isLoading ? <Spinner label="Загружаем карточку клиента" /> : null}

        {isError ? (
          <Alert tone="danger" title="Не удалось загрузить клиента">
            {error instanceof Error ? error.message : 'Попробуйте обновить страницу чуть позже.'}
          </Alert>
        ) : null}

        {!isLoading && !isError && !customer ? (
          <Alert tone="info" title="Клиент не найден">
            Проверьте корректность ссылки или вернитесь к списку клиентов.
          </Alert>
        ) : null}

        {customer ? (
          <article
            style={{
              background: 'var(--color-surface)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '32px',
            }}
          >
            <header style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h1 style={{ fontSize: '1.75rem' }}>{getDisplayName(customer)}</h1>
              {customer.tags.length ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {customer.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              ) : null}
              {customer.notes ? (
                <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                  {customer.notes}
                </p>
              ) : null}
            </header>

            <section
              style={{
                display: 'grid',
                gap: '24px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 style={{ fontSize: '1.125rem' }}>Контактная информация</h2>
                <dl style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Email
                    </dt>
                    <dd style={{ fontWeight: 600 }}>{customer.email || 'Не указан'}</dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Телефон
                    </dt>
                    <dd style={{ fontWeight: 600 }}>{customer.phone || 'Не указан'}</dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Создан
                    </dt>
                    <dd style={{ fontWeight: 600 }}>{formatDateTime(customer.created_at)}</dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Обновлён
                    </dt>
                    <dd style={{ fontWeight: 600 }}>{formatDateTime(customer.updated_at)}</dd>
                  </div>
                </dl>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 style={{ fontSize: '1.125rem' }}>Общие сведения</h2>
                <dl style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Тип клиента
                    </dt>
                    <dd style={{ fontWeight: 600 }}>
                      {CUSTOMER_TYPE_LABELS[customer.customer_type] ?? customer.customer_type}
                    </dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Ответственный
                    </dt>
                    <dd style={{ fontWeight: 600 }}>{customer.owner_id ?? 'Не назначен'}</dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>GDPR</dt>
                    <dd style={{ fontWeight: 600 }}>
                      {customer.gdpr_consent ? 'Согласие получено' : 'Согласие отсутствует'}
                    </dd>
                  </div>
                </dl>
              </div>

              {customer.company ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h2 style={{ fontSize: '1.125rem' }}>Компания</h2>
                  <dl style={{ display: 'grid', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        Название
                      </dt>
                      <dd style={{ fontWeight: 600 }}>{customer.company.name}</dd>
                    </div>
                    {customer.company.inn ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                          ИНН
                        </dt>
                        <dd style={{ fontWeight: 600 }}>{customer.company.inn}</dd>
                      </div>
                    ) : null}
                    {customer.company.kpp ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                          КПП
                        </dt>
                        <dd style={{ fontWeight: 600 }}>{customer.company.kpp}</dd>
                      </div>
                    ) : null}
                    {customer.company.email ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                          Email
                        </dt>
                        <dd style={{ fontWeight: 600 }}>{customer.company.email}</dd>
                      </div>
                    ) : null}
                    {customer.company.phone ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                          Телефон
                        </dt>
                        <dd style={{ fontWeight: 600 }}>{customer.company.phone}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              ) : null}
            </section>

            <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ fontSize: '1.25rem' }}>Контакты</h2>
              {customer.contacts.length ? (
                <ul
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    listStyle: 'none',
                    padding: 0,
                  }}
                >
                  {customer.contacts.map((contact) => (
                    <li
                      key={contact.id}
                      style={{
                        border: '1px solid var(--color-border)',
                        borderRadius: '12px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <strong>
                          {[contact.last_name, contact.first_name].filter(Boolean).join(' ') ||
                            'Без имени'}
                        </strong>
                        {contact.is_primary ? <Badge tone="info">Основной контакт</Badge> : null}
                      </div>
                      {contact.position ? <span>{contact.position}</span> : null}
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        Email: {contact.email || 'не указан'}
                      </span>
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        Телефон: {contact.phone || 'не указан'}
                      </span>
                      {contact.notes ? (
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          Заметки: {contact.notes}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <Alert tone="info" title="Контакты отсутствуют">
                  У клиента пока нет дополнительных контактных лиц.
                </Alert>
              )}
            </section>
          </article>
        ) : null}
      </div>
    </RoleGuard>
  );
}

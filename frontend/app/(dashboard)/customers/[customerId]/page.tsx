'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { useCustomer } from '@/entities/customer';
import { RoleGuard } from '@/features/auth';
import { Role } from '@/shared/config/roles';
import { Badge, Button, Spinner, Tag } from '@/shared/ui';

const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  individual: 'Физ. лицо',
  corporate: 'B2B',
};

const ADDRESS_TYPE_LABEL: Record<string, string> = {
  shipping: 'Адрес доставки',
  billing: 'Юр. адрес',
  other: 'Дополнительно',
};

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = Number(params?.customerId);
  const { data, isLoading, isError, error } = useCustomer(customerId, Number.isFinite(customerId));

  const title = data?.full_name || data?.email || 'Клиент';

  const primaryAddress = useMemo(
    () => data?.addresses.find((address) => address.is_primary) ?? data?.addresses[0],
    [data?.addresses]
  );

  return (
    <RoleGuard allow={[Role.SalesManager, Role.Accountant, Role.Admin]}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h1 style={{ margin: 0 }}>{title}</h1>
            {data ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <Badge tone="info">#{data.id}</Badge>
                <Badge tone={data.is_active ? 'success' : 'warning'}>
                  {data.is_active ? 'Активен' : 'Архив'}
                </Badge>
                <Badge tone="info">
                  {CUSTOMER_TYPE_LABEL[data.customer_type] ?? data.customer_type}
                </Badge>
                {data.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="ghost" onClick={() => router.back()}>
              Назад
            </Button>
            <Button variant="primary">Редактировать</Button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <Spinner />
          </div>
        ) : null}

        {isError ? (
          <div style={{ color: 'var(--color-text-danger)' }}>
            Не удалось загрузить данные клиента. {error?.message}
          </div>
        ) : null}

        {data ? (
          <div
            style={{
              display: 'grid',
              gap: '24px',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            }}
          >
            <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h2 style={{ margin: 0 }}>Контактные данные</h2>
              <div>
                Телефон: <strong>{data.phone}</strong>
              </div>
              <div>
                E-mail: <strong>{data.email}</strong>
              </div>
              <div>
                Основной адрес:{' '}
                <strong>
                  {primaryAddress
                    ? [
                        primaryAddress.city,
                        primaryAddress.street,
                        primaryAddress.building,
                        primaryAddress.apartment,
                      ]
                        .filter(Boolean)
                        .join(', ')
                    : 'не указан'}
                </strong>
              </div>
              {data.notes ? <div>Заметки: {data.notes}</div> : null}
            </section>

            <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h2 style={{ margin: 0 }}>Компания</h2>
              {data.company ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    Название: <strong>{data.company.name}</strong>
                  </div>
                  {data.company.legal_name ? <div>Юр. лицо: {data.company.legal_name}</div> : null}
                  {data.company.inn ? <div>ИНН: {data.company.inn}</div> : null}
                  {data.company.kpp ? <div>КПП: {data.company.kpp}</div> : null}
                  {data.company.email ? <div>E-mail: {data.company.email}</div> : null}
                  {data.company.phone ? <div>Телефон: {data.company.phone}</div> : null}
                </div>
              ) : (
                <div style={{ color: 'var(--color-text-muted)' }}>Компания не привязана.</div>
              )}
            </section>

            <section
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <h2 style={{ margin: 0 }}>Все адреса</h2>
              {data.addresses.length ? (
                <ul style={{ margin: 0, paddingLeft: '18px' }}>
                  {data.addresses.map((address) => (
                    <li key={address.id}>
                      <strong>
                        {ADDRESS_TYPE_LABEL[address.address_type] ?? address.address_type}
                      </strong>
                      :{' '}
                      {[
                        address.postal_code,
                        address.country,
                        address.region,
                        address.city,
                        address.street,
                        address.building,
                        address.apartment,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                      {address.is_primary ? ' (основной)' : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: 'var(--color-text-muted)' }}>Адреса не указаны.</div>
              )}
            </section>

            <section
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <h2 style={{ margin: 0 }}>Контакты</h2>
              {data.contacts.length ? (
                <ul style={{ margin: 0, paddingLeft: '18px' }}>
                  {data.contacts.map((contact) => (
                    <li key={contact.id}>
                      <strong>{contact.name}</strong>
                      {contact.position ? `, ${contact.position}` : ''}
                      {contact.email ? ` • ${contact.email}` : ''}
                      {contact.phone ? ` • ${contact.phone}` : ''}
                      {contact.is_primary ? ' (основной)' : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: 'var(--color-text-muted)' }}>Контакты не добавлены.</div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </RoleGuard>
  );
}

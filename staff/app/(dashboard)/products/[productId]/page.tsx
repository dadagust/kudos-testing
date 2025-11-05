'use client';

import { useRouter } from 'next/navigation';

import {
  AVAILABILITY_STATUS_LABELS,
  PRODUCT_STATUS_LABELS,
  RENTAL_UNIT_LABELS,
  useProductQuery,
} from '@/entities/product';
import { RoleGuard } from '@/features/auth';
import { ensureDateTimeDisplay } from '@/shared/lib/date';
import { Alert, Badge, Button, Spinner, Tag } from '@/shared/ui';

const formatCurrency = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

const formatDateTime = (value: string) => ensureDateTimeDisplay(value);

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
  active: 'success',
  draft: 'warning',
  archived: 'info',
};

const AVAILABILITY_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
  in_stock: 'success',
  reserved: 'warning',
  out_of_stock: 'danger',
};

interface ProductDetailsPageProps {
  params: { productId: string };
}

export default function ProductDetailsPage({ params }: ProductDetailsPageProps) {
  const router = useRouter();
  const { data: product, isLoading, isError, error } = useProductQuery(params.productId);

  return (
    <RoleGuard allow={['adminpanel_view_products', 'inventory_view_inventoryitem']}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button variant="ghost" onClick={() => router.back()}>
            ← Назад к списку
          </Button>
          {/* The API does not currently expose correlation trace identifiers for successful responses. */}
        </div>

        {isLoading ? <Spinner label="Загружаем карточку товара" /> : null}

        {isError ? (
          <Alert tone="danger" title="Не удалось загрузить товар">
            {error instanceof Error ? error.message : 'Проверьте соединение и попробуйте снова.'}
          </Alert>
        ) : null}

        {!isLoading && !isError && !product ? (
          <Alert tone="info" title="Товар не найден">
            Проверьте корректность ссылки или вернитесь к списку товаров.
          </Alert>
        ) : null}

        {product ? (
          <article
            style={{
              background: 'var(--color-surface)',
              borderRadius: '16px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            <header
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h1 style={{ fontSize: '1.75rem' }}>{product.name}</h1>
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {product.short_description}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge tone={STATUS_TONE[product.status] ?? 'info'}>
                  {PRODUCT_STATUS_LABELS[product.status]}
                </Badge>
                <Badge tone={AVAILABILITY_TONE[product.availability_status] ?? 'info'}>
                  {AVAILABILITY_STATUS_LABELS[product.availability_status]}
                </Badge>
              </div>
            </header>

            <section
              style={{
                display: 'grid',
                gap: '24px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 style={{ fontSize: '1.125rem' }}>Основная информация</h2>
                <dl style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Артикул
                    </dt>
                    <dd style={{ fontWeight: 600 }}>{product.sku}</dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Категория
                    </dt>
                    <dd style={{ fontWeight: 600 }}>{product.category.name}</dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Единица аренды
                    </dt>
                    <dd style={{ fontWeight: 600 }}>{RENTAL_UNIT_LABELS[product.rental_unit]}</dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Базовая цена
                    </dt>
                    <dd style={{ fontWeight: 600 }}>{formatCurrency.format(product.base_price)}</dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Залог
                    </dt>
                    <dd style={{ fontWeight: 600 }}>
                      {product.security_deposit
                        ? formatCurrency.format(product.security_deposit)
                        : 'Не требуется'}
                    </dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Создан
                    </dt>
                    <dd style={{ fontWeight: 600 }}>{formatDateTime(product.created_at)}</dd>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <dt style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                      Обновлён
                    </dt>
                    <dd style={{ fontWeight: 600 }}>{formatDateTime(product.updated_at)}</dd>
                  </div>
                </dl>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 style={{ fontSize: '1.125rem' }}>Описание</h2>
                <p style={{ lineHeight: 1.6 }}>{product.full_description}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '8px' }}>Атрибуты</h3>
                    <ul
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        listStyle: 'none',
                        padding: 0,
                      }}
                    >
                      {product.attributes.map((attribute) => (
                        <li key={attribute.attribute_id}>
                          <strong>{attribute.name}:</strong> {attribute.value}
                          {attribute.unit ? ` ${attribute.unit}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '8px' }}>Медиа</h3>
                    <ul
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        listStyle: 'none',
                        padding: 0,
                      }}
                    >
                      {product.media.map((media) => (
                        <li key={media.id}>
                          <a
                            href={media.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--color-accent)' }}
                          >
                            {media.alt_text || media.url}
                          </a>
                          {media.is_primary ? (
                            <span style={{ marginLeft: '8px' }}>
                              <Tag>Основное фото</Tag>
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          </article>
        ) : null}
      </div>
    </RoleGuard>
  );
}

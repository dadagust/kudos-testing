import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductBySlug, products } from '../../../lib/fixtures';
import { availabilityStatusMap, resolveStatus } from '../../../lib/status';
import { formatCurrency } from '../../../lib/format';

interface ProductPageProps {
  params: {
    slug: string;
  };
}

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export function generateMetadata({ params }: ProductPageProps): Metadata {
  const product = getProductBySlug(params.slug);

  if (!product) {
    return {
      title: 'Товар не найден — Kudos Storefront',
    };
  }

  return {
    title: `${product.name} — Kudos Storefront`,
    description: product.short_description,
  };
}

export default function ProductPage({ params }: ProductPageProps) {
  const product = getProductBySlug(params.slug);

  if (!product) {
    notFound();
  }

  const availability = resolveStatus(product.availability_status, availabilityStatusMap);
  const primaryMedia = product.media.find((item) => item.is_primary);

  return (
    <article className="stack">
      <header className="product-header">
        <div className="product-header__media" aria-hidden>
          <div
            className="product-header__image"
            style={
              primaryMedia?.url
                ? { backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.1) 10%, rgba(15, 23, 42, 0.85) 100%), url(${primaryMedia.url})` }
                : undefined
            }
            data-empty={!primaryMedia?.url}
          />
        </div>
        <div className="product-header__content">
          <div className="product-header__badges">
            <span className={`badge badge--${availability.tone}`}>{availability.label}</span>
            <span className="badge badge--neutral">{product.category.name}</span>
          </div>
          <h1 className="product-header__title">{product.name}</h1>
          <p className="product-header__description">{product.full_description}</p>
          <dl className="product-header__pricing">
            <div>
              <dt>Стоимость аренды</dt>
              <dd>{formatCurrency(product.base_price)} / {product.rental_unit === 'day' ? 'сутки' : product.rental_unit}</dd>
            </div>
            <div>
              <dt>Залог</dt>
              <dd>{formatCurrency(product.security_deposit)}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="section section--bordered">
        <div className="section__header section__header--compact">
          <h2 className="section__title">Характеристики</h2>
          <p className="section__subtitle">Подробности, которые помогут подобрать комплект.</p>
        </div>
        <dl className="product-specs">
          {product.attributes.map((attribute) => (
            <div key={attribute.attribute_id} className="product-specs__item">
              <dt>{attribute.name}</dt>
              <dd>
                {attribute.value}
                {attribute.unit ? ` ${attribute.unit}` : ''}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="section section--accent">
        <div className="section__header section__header--compact">
          <h2 className="section__title">Как забронировать</h2>
          <p className="section__subtitle">Заполните корзину, выберите даты и получите мгновенный расчёт.</p>
        </div>
        <ol className="product-steps">
          <li>Добавьте товар в корзину и укажите количество.</li>
          <li>Выберите даты аренды — мы автоматически проверим доступность.</li>
          <li>Оформите заказ онлайн или отправьте заявку менеджеру.</li>
        </ol>
        <div className="product-cta">
          <a className="button button--primary" href="/cart">
            Добавить в корзину
          </a>
          <a className="button button--ghost" href="/orders">
            Посмотреть статус заказов
          </a>
        </div>
      </section>
    </article>
  );
}

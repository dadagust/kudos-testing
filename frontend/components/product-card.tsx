import Link from 'next/link';
import type { Product } from '../lib/fixtures';
import { availabilityStatusMap, resolveStatus } from '../lib/status';
import { formatCurrency } from '../lib/format';

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const primaryMedia = product.media.find((item) => item.is_primary);
  const availability = resolveStatus(product.availability_status, availabilityStatusMap);

  return (
    <article className="card card--interactive product-card">
      <div
        className="product-card__media"
        style={
          primaryMedia?.url
            ? { backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0) 20%, rgba(15, 23, 42, 0.85) 100%), url(${primaryMedia.url})` }
            : undefined
        }
        data-empty={!primaryMedia?.url}
        aria-hidden
      />
      <div className="product-card__content">
        <div className="product-card__badges">
          <span className={`badge badge--${availability.tone}`}>{availability.label}</span>
          <span className="badge badge--neutral">{product.category.name}</span>
        </div>
        <h3 className="product-card__title">{product.name}</h3>
        <p className="product-card__description">{product.short_description}</p>
        <dl className="product-card__meta">
          <div>
            <dt className="product-card__meta-title">Стоимость аренды</dt>
            <dd className="product-card__price">{formatCurrency(product.base_price)}</dd>
          </div>
          <div>
            <dt className="product-card__meta-title">Залог</dt>
            <dd className="product-card__deposit">{formatCurrency(product.security_deposit)}</dd>
          </div>
        </dl>
        <Link className="button button--ghost" href={`/products/${product.slug}`}>
          Смотреть детали
        </Link>
      </div>
    </article>
  );
}

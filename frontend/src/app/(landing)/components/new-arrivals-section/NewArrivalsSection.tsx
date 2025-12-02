import Image from 'next/image';
import Link from 'next/link';
import { FC, useEffect, useMemo, useState } from 'react';

import {
  newArrivalsApi,
  type NewArrivalItem,
  type NewArrivalVariant,
} from '../../../../../lib/api';
import { Button } from '../../../../shared/ui/button/Button';

import styles from './new-arrivals-section.module.sass';

type RowItem =
  | {
      kind: 'product';
      item: NewArrivalItem;
    }
  | { kind: 'plus'; id: string };

const formatPrice = (value: number) =>
  new Intl.NumberFormat('ru-RU').format(Math.max(0, Math.round(value)));

const buildRows = (items: NewArrivalItem[], itemsPerRow: number): RowItem[][] => {
  const rows: RowItem[][] = [];

  for (let index = 0; index < items.length; index += itemsPerRow) {
    const rowItems = items.slice(index, index + itemsPerRow);
    const row: RowItem[] = [];

    rowItems.forEach((item, itemIndex) => {
      row.push({ kind: 'product', item });

      if (itemIndex < rowItems.length - 1) {
        row.push({ kind: 'plus', id: `plus-${index}-${itemIndex}` });
      }
    });

    rows.push(row);
  }

  return rows;
};

const resolveColorStyle = (value: string, isActive: boolean) => {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'multicolored') {
    return {
      background: 'linear-gradient(135deg, #f4a261 0%, #8ec5fc 50%, #ff6f91 100%)',
      borderColor: isActive ? '#4a4b4d' : '#c0c0c0',
    };
  }

  if (normalized === 'not-important') {
    return {
      backgroundColor: 'transparent',
      borderColor: isActive ? '#4a4b4d' : '#b7b7b7',
    };
  }

  const color = normalized || '#d8d8d8';

  return {
    backgroundColor: color,
    borderColor: isActive ? '#4a4b4d' : '#d0d0d0',
  };
};

export const NewArrivalsSection: FC = () => {
  const [items, setItems] = useState<NewArrivalItem[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [itemsPerRow, setItemsPerRow] = useState(4);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const updateLayout = () => {
      if (typeof window === 'undefined') return;

      if (window.innerWidth <= 480) {
        setItemsPerRow(1);
      } else if (window.innerWidth <= 900) {
        setItemsPerRow(2);
      } else {
        setItemsPerRow(4);
      }
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);

    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const data = await newArrivalsApi.list();
        setItems(data);

        const defaults: Record<string, string> = {};
        data.forEach((item) => {
          if (item.type === 'group' && item.variants?.length) {
            defaults[item.id] = item.variants[0].id;
          }
        });
        setSelectedVariants((prev) => ({ ...defaults, ...prev }));
      } catch (err) {
        setError('Не удалось загрузить новинки. Пожалуйста, попробуйте позже.');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchItems();
  }, []);

  const displayedItems = useMemo(() => items.slice(0, 10), [items]);

  const rows = useMemo(
    () => buildRows(displayedItems, Math.max(1, itemsPerRow)),
    [displayedItems, itemsPerRow],
  );

  const selectVariant = (itemId: string, variantId: string) => {
    setSelectedVariants((prev) => ({ ...prev, [itemId]: variantId }));
  };

  const resolveActiveVariant = (item: NewArrivalItem): NewArrivalVariant | null => {
    if (item.type !== 'group' || !item.variants?.length) {
      return null;
    }

    const selectedId = selectedVariants[item.id];
    return item.variants.find((variant) => variant.id === selectedId) ?? item.variants[0];
  };

  const resolveImage = (item: NewArrivalItem) => {
    if (item.type === 'group') {
      const variant = resolveActiveVariant(item);
      return variant?.image || item.image || '';
    }

    return item.image || '';
  };

  const renderCard = (item: NewArrivalItem) => {
    const isGroup = item.type === 'group' && (item.variants?.length ?? 0) > 0;
    const activeVariant = resolveActiveVariant(item);
    const imageSrc = resolveImage(item);
    const priceText = `${formatPrice(item.price_rub)} ₽ за сутки`;

    return (
      <article key={item.id} className={styles.card}>
        <Link
          href={item.slug || '#'}
          className={styles.cardMedia}
          aria-label={`Подробнее о ${item.name}`}
          prefetch={false}
        >
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={item.name}
              fill
              className={styles.cardImage}
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
            />
          ) : (
            <div className={styles.cardPlaceholder} aria-hidden />
          )}
        </Link>

        {isGroup && (
          <div className={styles.variantBlock}>
            <div className={styles.variantName}>{activeVariant?.color_name || 'Цвет'}</div>
            <div className={styles.variantList} role="list" aria-label="Выбор цвета">
              {item.variants?.map((variant) => {
                const isActive = activeVariant?.id === variant.id;
                const style = resolveColorStyle(variant.color_value, isActive);

                return (
                  <button
                    key={variant.id}
                    type="button"
                    className={`${styles.colorDot}${isActive ? ` ${styles.colorDotActive}` : ''}`}
                    style={style}
                    onClick={() => selectVariant(item.id, variant.id)}
                    aria-pressed={isActive}
                    aria-label={variant.color_name}
                  />
                );
              })}
            </div>
          </div>
        )}

        <Link href={item.slug || '#'} className={styles.cardTitle} prefetch={false}>
          {item.name}
        </Link>
        <div className={styles.cardPrice}>{priceText}</div>
      </article>
    );
  };

  const renderSkeletonCard = (key: string) => (
    <div key={key} className={styles.cardSkeleton} aria-hidden>
      <div className={styles.cardSkeletonImage} />
      <div className={styles.cardSkeletonTitle} />
      <div className={styles.cardSkeletonPrice} />
    </div>
  );

  const skeletonRows = useMemo(
    () => buildRows(Array.from({ length: Math.max(itemsPerRow * 2, 4) }, (_, index) => ({
      id: `skeleton-${index}`,
      type: 'product',
      name: '',
      price_rub: 0,
    } as NewArrivalItem)), Math.max(1, itemsPerRow)),
    [itemsPerRow],
  );

  return (
    <section className={styles.section} aria-labelledby="new-arrivals-title">
      <div className={styles.container}>
        <h2 id="new-arrivals-title" className={styles.title}>
          Новинки этого года
        </h2>

        {error && !isLoading && <p className={styles.error}>{error}</p>}

        <div className={styles.rows}>
          {isLoading
            ? skeletonRows.map((row, rowIndex) => (
                <div key={`skeleton-row-${rowIndex}`} className={styles.row}>
                  {row.map((item) =>
                    item.kind === 'plus' ? (
                      <div key={item.id} className={`${styles.plus} ${styles.plusSkeleton}`} aria-hidden>
                        +
                      </div>
                    ) : (
                      renderSkeletonCard(item.item.id)
                    ),
                  )}
                </div>
              ))
            : rows.map((row, rowIndex) => (
                <div key={`row-${rowIndex}`} className={styles.row}>
                  {row.map((element) =>
                    element.kind === 'plus' ? (
                      <div key={element.id} className={styles.plus} aria-hidden>
                        +
                      </div>
                    ) : (
                      renderCard(element.item)
                    ),
                  )}
                </div>
              ))}
        </div>

        <div className={styles.actions}>
          <Button className={styles.showAllButton} size="lg">
            Показать все новинки
          </Button>
        </div>
      </div>
    </section>
  );
};

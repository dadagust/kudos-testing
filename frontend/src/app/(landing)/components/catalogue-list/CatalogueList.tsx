import Image from 'next/image';
import { FC, useEffect, useState } from 'react';

import { catalogueApi, type CatalogueCategory } from '../../../../../lib/api';

import styles from './catalogue-list.module.sass';

export const CatalogueList: FC = () => {
  const [categories, setCategories] = useState<CatalogueCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const catalogue = await catalogueApi.list();
        setCategories(catalogue);
      } catch (err) {
        setError('Не удалось загрузить каталог. Пожалуйста, попробуйте позже.');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchCategories();
  }, []);

  const renderCard = (category: CatalogueCategory) => (
    <article key={category.id} className={styles.card}>
      <div className={styles.cardMedia}>
        {category.image ? (
          <Image
            src={category.image}
            alt={category.name}
            fill
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 32vw"
            className={styles.cardImage}
          />
        ) : (
          <div className={styles.cardPlaceholder} aria-hidden />
        )}
        <div className={styles.cardOverlay} />
      </div>
      <div className={styles.cardTitle}>{category.name}</div>
    </article>
  );

  return (
    <section className={styles.section} aria-labelledby="catalogue-title">
      <div className={styles.container}>
        <h2 id="catalogue-title" className={styles.title}>
          Каталог
        </h2>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.grid}>
          {isLoading && <div className={styles.skeletonRow} aria-hidden />}
          {!isLoading && categories.map(renderCard)}
        </div>
      </div>
    </section>
  );
};

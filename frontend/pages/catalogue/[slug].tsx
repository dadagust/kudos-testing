import Head from 'next/head';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {FC, useEffect, useMemo, useState} from 'react';

import {
  categoriesApi,
  categoryProductsApi,
  type CategoryTreeItem,
  type NewArrivalItem,
  type NewArrivalVariant,
} from '../../lib/api';
import {TopBar, FrontendHeader} from '../../src/app/(landing)/components/hero-section/HeroSection';
import {FrontendFooter} from '../../src/app/(landing)/components/footer/Footer';

import styles from '../../src/app/catalogue/category-catalogue-page.module.sass';

const formatPrice = (value: number) => new Intl.NumberFormat('ru-RU').format(Math.max(0, Math.round(value)));

const buildRows = (items: NewArrivalItem[], itemsPerRow: number): NewArrivalItem[][] => {
  const rows: NewArrivalItem[][] = [];

  for (let index = 0; index < items.length; index += itemsPerRow) {
    const rowItems = items.slice(index, index + itemsPerRow);
    rows.push(rowItems);
  }

  return rows;
};

const resolveColorStyle = (value: string, isActive: boolean) => {
  const normalized = value.trim();
  const normalizedLower = normalized.toLowerCase();
  if (normalizedLower === 'multicolored') {
    return {
      background: 'linear-gradient(135deg, #f4a261 0%, #8ec5fc 50%, #ff6f91 100%)',
      borderColor: isActive ? '#4a4b4d' : '#c0c0c0',
    };
  }

  if (normalizedLower === 'not-important') {
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

const findCategoryBySlug = (
  tree: CategoryTreeItem[],
  slug: string
): { node: CategoryTreeItem; parent: CategoryTreeItem | null } | null => {
  for (const node of tree) {
    if (node.slug === slug) {
      return { node, parent: null };
    }

    if (node.children.length) {
      const found = findCategoryBySlug(node.children, slug);
      if (found) {
        return { node: found.node, parent: node };
      }
    }
  }

  return null;
};

const CategoryPageContent: FC<{ slug: string }> = ({slug}) => {
  const [items, setItems] = useState<NewArrivalItem[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [itemsPerRow, setItemsPerRow] = useState(4);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [subcategories, setSubcategories] = useState<CategoryTreeItem[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const updateLayout = () => {
      if (typeof window === 'undefined') return;

      if (window.innerWidth <= 480) {
        setItemsPerRow(1);
      } else if (window.innerWidth <= 900) {
        setItemsPerRow(2);
      } else if (window.innerWidth >= 1400) {
        setItemsPerRow(5);
      } else {
        setItemsPerRow(4);
      }
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);

    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1000px)');
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsMenuOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    const fetchItems = async () => {
      setIsLoading(true);
      try {
        const data = await categoryProductsApi.listBySlug(slug);
        setItems(data);

        const defaults: Record<string, string> = {};
        data.forEach((item) => {
          if (item.type === 'group' && item.variants?.length) {
            defaults[item.id] = item.variants[0].id;
          }
        });
        setSelectedVariants((prev) => ({ ...defaults, ...prev }));
        setError(null);
      } catch (err) {
        setError('Не удалось загрузить товары категории. Пожалуйста, попробуйте позже.');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchItems();
  }, [slug]);

  useEffect(() => {
    const fetchCategoryTree = async () => {
      try {
        const tree = await categoriesApi.tree();
        const found = findCategoryBySlug(tree, slug);

        if (found?.node) {
          setCategoryName(found.node.name);
          setSubcategories(found.node.children);
        } else {
          setCategoryName('Каталог');
          setSubcategories([]);
        }
      } catch {
        setCategoryName('Каталог');
        setSubcategories([]);
      }
    };

    void fetchCategoryTree();
  }, [slug]);

  const rows = useMemo(() => {
    const safeItemsPerRow = Math.max(1, itemsPerRow);
    return safeItemsPerRow === 1 ? [items] : buildRows(items, safeItemsPerRow);
  }, [items, itemsPerRow]);

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
      const activeVariant = resolveActiveVariant(item);
      if (activeVariant?.image) {
        return activeVariant.image;
      }
      return item.variants?.[0]?.image ?? '';
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
        <div className={styles.cardMediaWrapper}>
          <Link
            href={item.slug || '#'}
            className={styles.cardMedia}
            aria-label={`Подробнее о ${item.name}`}
            prefetch={false}
          >
            {imageSrc ? (
              <img src={imageSrc} alt={item.name} className={styles.cardImage} />
            ) : (
              <div className={styles.cardPlaceholder} aria-hidden />
            )}
          </Link>

          {isGroup && (
            <div className={styles.variantBlock}>
              <div className={styles.variantName}>
                {activeVariant?.name || activeVariant?.color_name || 'Цвет'}
              </div>
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
                      aria-label={variant.name || variant.color_name}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <button type="button" className={styles.plusButton} aria-label="Добавить в подборку">
            +
          </button>
        </div>

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

  const skeletonRows = useMemo(() => {
    const safeItemsPerRow = Math.max(1, itemsPerRow);
    const skeletonItems = Array.from({length: Math.max(itemsPerRow * 2, 4)}, (_, index) => ({
      id: `skeleton-${index}`,
      type: 'product',
      name: '',
      price_rub: 0,
    } as NewArrivalItem));

    return safeItemsPerRow === 1 ? [skeletonItems] : buildRows(skeletonItems, safeItemsPerRow);
  }, [itemsPerRow]);

  return (
    <div className={styles.page}>
      <TopBar isMobile={isMobile} onMenuToggle={() => setIsMenuOpen((prev) => !prev)} isMenuOpen={isMenuOpen} />
      <FrontendHeader isMobile={isMobile} />

      <section className={styles.header}>
        <div className={styles.container}>
          <div className={styles.breadcrumbs}>
            <Link href="/" className={styles.breadcrumbLink} prefetch={false}>
              Главная
            </Link>
            <span className={styles.breadcrumbDivider}>/</span>
            <Link href="/#catalogue-title" className={styles.breadcrumbLink} prefetch={false}>
              Каталог
            </Link>
            <span className={styles.breadcrumbDivider}>/</span>
            <span>{categoryName || slug}</span>
          </div>
          <h1 id="catalogue-category-title" className={styles.categoryTitle}>
            {categoryName || 'Каталог'}
          </h1>

          <div className={styles.controls}>
            <div className={styles.subcategoryList}>
              {subcategories.length === 0 && <span className={styles.breadcrumbLink}>Подкатегорий нет</span>}
              {subcategories.map((subcategory) => (
                <Link
                  key={subcategory.id}
                  href={`/catalogue/${subcategory.slug}`}
                  className={`${styles.subcategoryItem}${subcategory.slug === slug ? ` ${styles.currentSubcategory}` : ''}`}
                  prefetch={false}
                >
                  {subcategory.name}
                </Link>
              ))}
            </div>

            <div className={styles.filterControls}>
              <button type="button" className={styles.controlButton}>
                Сортировка
              </button>
              <button type="button" className={styles.controlButton}>
                Фильтры
              </button>
            </div>
          </div>

          {error && !isLoading && <p className={styles.error}>{error}</p>}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="catalogue-category-title">
        <div className={styles.container}>
          <div className={styles.rows}>
            {isLoading
              ? skeletonRows.map((row, rowIndex) => (
                  <div key={`skeleton-row-${rowIndex}`} className={styles.row}>
                    {row.map((item) => renderSkeletonCard(item.id))}
                  </div>
                ))
              : rows.map((row, rowIndex) => (
                  <div key={`row-${rowIndex}`} className={styles.row}>
                    {row.map((element) => renderCard(element))}
                  </div>
                ))}
          </div>
        </div>
      </section>

      <FrontendFooter />
    </div>
  );
};

const CatalogueCategoryPage: FC = () => {
  const router = useRouter();
  const slug = router.query.slug;
  const normalizedSlug = typeof slug === 'string' ? slug : '';

  return (
    <>
      <Head>
        <title>Каталог — {normalizedSlug}</title>
      </Head>
      {normalizedSlug && <CategoryPageContent slug={normalizedSlug} />}
    </>
  );
};

export default CatalogueCategoryPage;

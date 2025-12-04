import Head from 'next/head';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {FC, useEffect, useMemo, useState} from 'react';

import {
  categoryProductsApi,
  type CategoryTreeItem,
  type NewArrivalItem,
  type NewArrivalVariant,
} from '../../lib/api';
import {TopBar, FrontendHeader} from '../../src/app/(landing)/components/hero-section/HeroSection';
import {FrontendFooter} from '../../src/app/(landing)/components/footer/Footer';

import styles from '../../src/app/catalogue/category-catalogue-page.module.sass';

const formatPrice = (value: number) => new Intl.NumberFormat('ru-RU').format(Math.max(0, Math.round(value)));

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

const normalizeColorValue = (value?: string | null) => (value ?? '').trim().toLowerCase();

const CategoryPageContent: FC<{ slug: string }> = ({slug}) => {
  const [items, setItems] = useState<NewArrivalItem[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [subcategories, setSubcategories] = useState<CategoryTreeItem[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [colorOptions, setColorOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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
    setSortOrder(null);
    setSelectedColors([]);
    setColorOptions([]);
    setIsSortOpen(false);
    setIsFilterOpen(false);

    const fetchItems = async () => {
      setIsLoading(true);
      try {
        const { items: data, colors, subcategories: fetchedSubcategories, category } =
          await categoryProductsApi.listBySlug(slug);
        setItems(data);
        setColorOptions(colors ?? []);
        setSubcategories(slug === 'new' ? [] : fetchedSubcategories ?? []);
        setCategoryName(() => {
          if (slug === 'new') {
            return 'Новинки';
          }

          if (category?.name) {
            return category.name;
          }

          return 'Каталог';
        });

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

  const availableColors = useMemo(
    () =>
      colorOptions.map((color) => ({
        key: normalizeColorValue(color.value || color.label),
        ...color,
      })),
    [colorOptions]
  );

  const filteredItems = useMemo(() => {
    let nextItems = items;

    if (selectedColors.length) {
      nextItems = nextItems.filter((item) => {
        if (item.type !== 'group' || !item.variants?.length) {
          const key = normalizeColorValue(item.color_value || item.color_name);

          return key ? selectedColors.includes(key) : false;
        }

        return item.variants.some((variant) => {
          const key = normalizeColorValue(
            variant.color_value || variant.color_name || variant.name || variant.slug
          );
          return selectedColors.includes(key);
        });
      });
    }

    if (!sortOrder) {
      return nextItems;
    }

    const sortedItems = [...nextItems].sort((first, second) => {
      if (sortOrder === 'asc') {
        return first.price_rub - second.price_rub;
      }

      return second.price_rub - first.price_rub;
    });

    return sortedItems;
  }, [items, selectedColors, sortOrder]);

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
      const variantImage = resolveActiveVariant(item)?.image ?? item.variants?.[0]?.image;

      return variantImage || item.image || '';
    }

    return item.image || '';
  };

  const handleSortSelect = (order: 'asc' | 'desc') => {
    setSortOrder((prev) => (prev === order ? null : order));
    setIsSortOpen(false);
    setIsFilterOpen(false);
  };

  const resetSort = () => {
    setSortOrder(null);
    setIsSortOpen(false);
  };

  const toggleColor = (colorKey: string) => {
    setSelectedColors((prev) => {
      if (prev.includes(colorKey)) {
        return prev.filter((key) => key !== colorKey);
      }

      return [...prev, colorKey];
    });
  };

  const resetFilters = () => {
    setSelectedColors([]);
    setIsFilterOpen(false);
  };

  const renderCard = (item: NewArrivalItem) => {
    const isGroup = item.type === 'group' && (item.variants?.length ?? 0) > 0;
    const activeVariant = resolveActiveVariant(item);
    const imageSrc = resolveImage(item);
    const price = activeVariant?.price_rub ?? item.price_rub;
    const priceText = `${formatPrice(price)} ₽ за сутки`;
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

  const skeletonItems = useMemo(
    () =>
      Array.from({length: 10}, (_, index) => ({
        id: `skeleton-${index}`,
        type: 'product',
        name: '',
        price_rub: 0,
      } as NewArrivalItem)),
    []
  );

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
              <div className={styles.controlGroup}>
                <button
                  type="button"
                  className={styles.controlToggle}
                  onClick={() => {
                    setIsSortOpen((prev) => !prev);
                    setIsFilterOpen(false);
                  }}
                  aria-expanded={isSortOpen}
                >
                  <span>Сортировка</span>
                  <span className={`${styles.chevron}${isSortOpen ? ` ${styles.chevronOpen}` : ''}`} aria-hidden />
                </button>

                {isSortOpen && (
                  <div className={styles.dropdown} role="menu">
                    <button
                      type="button"
                      className={`${styles.dropdownOption}${sortOrder === 'asc' ? ` ${styles.dropdownOptionActive}` : ''}`}
                      onClick={() => handleSortSelect('asc')}
                    >
                      Дешевле
                    </button>
                    <button
                      type="button"
                      className={`${styles.dropdownOption}${sortOrder === 'desc' ? ` ${styles.dropdownOptionActive}` : ''}`}
                      onClick={() => handleSortSelect('desc')}
                    >
                      Дороже
                    </button>
                    <button
                      type="button"
                      className={styles.resetButton}
                      onClick={resetSort}
                      disabled={!sortOrder}
                    >
                      Сбросить сортировку
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.controlGroup}>
                <button
                  type="button"
                  className={styles.controlToggle}
                  onClick={() => {
                    setIsFilterOpen((prev) => !prev);
                    setIsSortOpen(false);
                  }}
                  aria-expanded={isFilterOpen}
                >
                  <span>Фильтры</span>
                </button>

                {isFilterOpen && (
                  <div className={styles.dropdown} role="menu">
                    {availableColors.length === 0 && <div className={styles.dropdownEmpty}>Цвета отсутствуют</div>}

                    {availableColors.map((color) => {
                      const isActive = selectedColors.includes(color.key);

                      return (
                        <label
                          key={color.key}
                          className={`${styles.checkboxOption}${isActive ? ` ${styles.checkboxOptionActive}` : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => toggleColor(color.key)}
                            className={styles.checkboxInput}
                          />
                          <span
                            className={styles.colorPreview}
                            style={{ backgroundColor: color.value || '#d8d8d8' }}
                            aria-hidden
                          />
                          <span>{color.label}</span>
                        </label>
                      );
                    })}

                    <button
                      type="button"
                      className={styles.resetButton}
                      onClick={resetFilters}
                      disabled={!selectedColors.length}
                    >
                      Сбросить фильтры
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && !isLoading && <p className={styles.error}>{error}</p>}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="catalogue-category-title">
        <div className={styles.container}>
          <div className={styles.grid}>
            {isLoading
              ? skeletonItems.map((item) => renderSkeletonCard(item.id))
              : filteredItems.map((element) => renderCard(element))}
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

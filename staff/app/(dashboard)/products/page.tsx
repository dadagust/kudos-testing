'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import {
  ProductCategoriesResponseItem,
  ProductListItem,
  ProductListQuery,
  EnumOption,
  ProductColor,
  DimensionShape,
  InstallerQualification,
  ReservationMode,
  RentalBasePeriod,
  TransportRestriction,
  ProductCreatePayload,
  ProductCreateResponse,
  ProductDetail,
  ProductImage,
  ProductComplementarySummary,
  ProductUpdatePayload,
  productsApi,
  useInfiniteProductsQuery,
} from '@/entities/product';
import { RoleGuard, usePermission } from '@/features/auth';
import { Alert, Badge, Button, FormField, Input, Modal, Select, Spinner, Accordion } from '@/shared/ui';

const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

const orderingOptions: { value: NonNullable<ProductListQuery['ordering']>; label: string }[] = [
  { value: '-created_at', label: 'Сначала новые' },
  { value: 'created_at', label: 'Сначала старые' },
  { value: 'price_rub', label: 'Цена по возрастанию' },
  { value: '-price_rub', label: 'Цена по убыванию' },
  { value: 'name', label: 'По алфавиту' },
  { value: '-name', label: 'По алфавиту (обратно)' },
];

const selfPickupOptions = [
  { value: '', label: 'Самовывоз: все' },
  { value: 'true', label: 'Только с самовывозом' },
  { value: 'false', label: 'Только доставка' },
];

const formatPrice = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const amount = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(amount)) {
    return '—';
  }
  return currencyFormatter.format(amount);
};

const flattenCategories = (
  nodes: ProductCategoriesResponseItem[],
  depth = 0
): { value: string; label: string }[] => {
  return nodes.flatMap((node) => [
    { value: node.id, label: `${' '.repeat(depth * 2)}${node.name}` },
    ...(node.children ? flattenCategories(node.children, depth + 1) : []),
  ]);
};

const buildCategoryNameMap = (
  nodes: ProductCategoriesResponseItem[],
  acc: Record<string, string> = {}
): Record<string, string> => {
  nodes.forEach((node) => {
    acc[node.id] = node.name;
    if (node.children?.length) {
      buildCategoryNameMap(node.children, acc);
    }
  });
  return acc;
};

const createEnumMap = (options?: EnumOption[]) =>
  options?.reduce<Record<string, string>>((acc, option) => {
    acc[option.value] = option.label;
    return acc;
  }, {}) ?? {};

type CreateProductFormState = {
  name: string;
  categoryId: string;
  priceRub: string;
  lossCompensationRub: string;
  color: ProductColor | '';
  features: string[];
  featureDraft: string;
  complementaryProducts: ProductComplementarySummary[];
  dimensions: {
    shape: DimensionShape | '';
    circle: { diameter_cm: string };
    line: { length_cm: string };
    rectangle: { length_cm: string; width_cm: string };
    cylinder: { diameter_cm: string; height_cm: string };
    box: { height_cm: string; width_cm: string; depth_cm: string };
  };
  occupancy: {
    cleaning_days: string;
    insurance_reserve_percent: string;
  };
  delivery: {
    volume_cm3: string;
    weight_kg: string;
    transport_restriction: TransportRestriction | '';
    self_pickup_allowed: boolean;
  };
  setup: {
    install_minutes: string;
    uninstall_minutes: string;
    installer_qualification: InstallerQualification | '';
    min_installers: string;
    self_setup_allowed: boolean;
  };
  rental: {
    base_period: RentalBasePeriod | '';
  };
  visibility: {
    reservation_mode: ReservationMode | '';
    show_on_pifakit: boolean;
    show_on_site: boolean;
    show_in_new: boolean;
    category_cover_on_home: boolean;
  };
  seo: {
    slug: string;
    meta_title: string;
    meta_description: string;
    meta_keywords: string[];
  };
  metaKeywordDraft: string;
};

type ProductFormMode = 'create' | 'edit';

type ProductFormImage = {
  id: string;
  previewUrl: string;
  isPrimary: boolean;
  file?: File;
  remoteId?: string;
  removed?: boolean;
};

const createEmptyProductForm = (defaults?: {
  rentalBasePeriod?: RentalBasePeriod;
  reservationMode?: ReservationMode;
  transportRestriction?: TransportRestriction;
  installerQualification?: InstallerQualification;
  minInstallers?: number;
}): CreateProductFormState => ({
  name: '',
  categoryId: '',
  priceRub: '',
  lossCompensationRub: '',
  color: '' as ProductColor | '',
  features: [],
  featureDraft: '',
  complementaryProducts: [],
  dimensions: {
    shape: '' as DimensionShape | '',
    circle: { diameter_cm: '' },
    line: { length_cm: '' },
    rectangle: { length_cm: '', width_cm: '' },
    cylinder: { diameter_cm: '', height_cm: '' },
    box: { height_cm: '', width_cm: '', depth_cm: '' },
  },
  occupancy: {
    cleaning_days: '',
    insurance_reserve_percent: '',
  },
  delivery: {
    volume_cm3: '',
    weight_kg: '',
    transport_restriction: (defaults?.transportRestriction ?? '') as TransportRestriction | '',
    self_pickup_allowed: true,
  },
  setup: {
    install_minutes: '',
    uninstall_minutes: '',
    installer_qualification: (defaults?.installerQualification ?? '') as
      | InstallerQualification
      | '',
    min_installers: defaults?.minInstallers ? String(defaults.minInstallers) : '',
    self_setup_allowed: false,
  },
  rental: {
    base_period: (defaults?.rentalBasePeriod ?? '') as RentalBasePeriod | '',
  },
  visibility: {
    reservation_mode: (defaults?.reservationMode ?? '') as ReservationMode | '',
    show_on_pifakit: true,
    show_on_site: true,
    show_in_new: true,
    category_cover_on_home: false,
  },
  seo: {
    slug: '',
    meta_title: '',
    meta_description: '',
    meta_keywords: [],
  },
  metaKeywordDraft: '',
});

const createFormFromProduct = (product: ProductDetail): CreateProductFormState => {
  const base = createEmptyProductForm();
  const shape = (product.dimensions?.shape ?? '') as DimensionShape | '';
  return {
    ...base,
    name: product.name ?? '',
    categoryId: product.category_id ?? product.category?.id ?? '',
    priceRub:
      product.price_rub !== undefined && product.price_rub !== null
        ? String(product.price_rub)
        : '',
    lossCompensationRub:
      product.loss_compensation_rub !== undefined && product.loss_compensation_rub !== null
        ? String(product.loss_compensation_rub)
        : '',
    color: (product.color ?? '') as ProductColor | '',
    features: product.features ?? [],
    featureDraft: '',
    complementaryProducts:
      product.complementary_products?.map((item) => ({ id: item.id, name: item.name })) ??
      (product.complementary_product_ids?.map((id) => ({ id, name: id })) ?? []),
    dimensions: {
      shape,
      circle: {
        diameter_cm:
          product.dimensions?.circle?.diameter_cm !== undefined &&
          product.dimensions?.circle?.diameter_cm !== null
            ? String(product.dimensions.circle.diameter_cm)
            : '',
      },
      line: {
        length_cm:
          product.dimensions?.line?.length_cm !== undefined &&
          product.dimensions?.line?.length_cm !== null
            ? String(product.dimensions.line.length_cm)
            : '',
      },
      rectangle: {
        length_cm:
          product.dimensions?.rectangle?.length_cm !== undefined &&
          product.dimensions?.rectangle?.length_cm !== null
            ? String(product.dimensions.rectangle.length_cm)
            : '',
        width_cm:
          product.dimensions?.rectangle?.width_cm !== undefined &&
          product.dimensions?.rectangle?.width_cm !== null
            ? String(product.dimensions.rectangle.width_cm)
            : '',
      },
      cylinder: {
        diameter_cm:
          product.dimensions?.cylinder?.diameter_cm !== undefined &&
          product.dimensions?.cylinder?.diameter_cm !== null
            ? String(product.dimensions.cylinder.diameter_cm)
            : '',
        height_cm:
          product.dimensions?.cylinder?.height_cm !== undefined &&
          product.dimensions?.cylinder?.height_cm !== null
            ? String(product.dimensions.cylinder.height_cm)
            : '',
      },
      box: {
        height_cm:
          product.dimensions?.box?.height_cm !== undefined &&
          product.dimensions?.box?.height_cm !== null
            ? String(product.dimensions.box.height_cm)
            : '',
        width_cm:
          product.dimensions?.box?.width_cm !== undefined &&
          product.dimensions?.box?.width_cm !== null
            ? String(product.dimensions.box.width_cm)
            : '',
        depth_cm:
          product.dimensions?.box?.depth_cm !== undefined &&
          product.dimensions?.box?.depth_cm !== null
            ? String(product.dimensions.box.depth_cm)
            : '',
      },
    },
    occupancy: {
      cleaning_days:
        product.occupancy?.cleaning_days !== undefined && product.occupancy?.cleaning_days !== null
          ? String(product.occupancy.cleaning_days)
          : '',
      insurance_reserve_percent:
        product.occupancy?.insurance_reserve_percent !== undefined &&
        product.occupancy?.insurance_reserve_percent !== null
          ? String(product.occupancy.insurance_reserve_percent)
          : '',
    },
    delivery: {
      volume_cm3:
        product.delivery?.volume_cm3 !== undefined && product.delivery?.volume_cm3 !== null
          ? String(product.delivery.volume_cm3)
          : '',
      weight_kg:
        product.delivery?.weight_kg !== undefined &&
        product.delivery?.weight_kg !== null &&
        product.delivery?.weight_kg !== ''
          ? String(product.delivery.weight_kg)
          : '',
      transport_restriction: (product.delivery?.transport_restriction ?? '') as
        | TransportRestriction
        | '',
      self_pickup_allowed:
        product.delivery?.self_pickup_allowed ?? base.delivery.self_pickup_allowed,
    },
    setup: {
      install_minutes:
        product.setup?.install_minutes !== undefined && product.setup?.install_minutes !== null
          ? String(product.setup.install_minutes)
          : '',
      uninstall_minutes:
        product.setup?.uninstall_minutes !== undefined && product.setup?.uninstall_minutes !== null
          ? String(product.setup.uninstall_minutes)
          : '',
      installer_qualification: (product.setup?.installer_qualification ?? '') as
        | InstallerQualification
        | '',
      min_installers:
        product.setup?.min_installers !== undefined && product.setup?.min_installers !== null
          ? String(product.setup.min_installers)
          : '',
      self_setup_allowed: product.setup?.self_setup_allowed ?? base.setup.self_setup_allowed,
    },
    rental: {
      base_period: (product.rental?.base_period ?? '') as RentalBasePeriod | '',
    },
    visibility: {
      reservation_mode: (product.visibility?.reservation_mode ?? '') as ReservationMode | '',
      show_on_pifakit: product.visibility?.show_on_pifakit ?? base.visibility.show_on_pifakit,
      show_on_site: product.visibility?.show_on_site ?? base.visibility.show_on_site,
      show_in_new: product.visibility?.show_in_new ?? base.visibility.show_in_new,
      category_cover_on_home:
        product.visibility?.category_cover_on_home ?? base.visibility.category_cover_on_home,
    },
    seo: {
      slug: product.seo?.slug ?? '',
      meta_title: product.seo?.meta_title ?? '',
      meta_description: product.seo?.meta_description ?? '',
      meta_keywords: product.seo?.meta_keywords ?? [],
    },
    metaKeywordDraft: '',
  };
};

const mapProductImagesToForm = (images?: ProductImage[]): ProductFormImage[] => {
  if (!images?.length) {
    return [];
  }
  return [...images]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((image, index) => ({
      id: `existing-${image.id}`,
      previewUrl: image.url,
      isPrimary: index === 0,
      remoteId: image.id,
    }));
};

// ЗАПРЕЩАЕМ служебные символы в number-полях (e, +, -), чтобы браузер не давал ввод в экспоненциальной форме
const blockExpAndSigns = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (['e', 'E', '+', '-'].includes(e.key)) {
    e.preventDefault();
  }
};

// Улучшаем: поддержка запятой, нескольких точек, ведущих нулей, "висящей" точки в конце
const sanitizeNumericInput = (
  value: string,
  { allowDecimal = false }: { allowDecimal?: boolean } = {}
) => {
  if (!allowDecimal) {
    // только целые
    return value.replace(/\D+/g, '');
  }

  // дробные: меняем запятую на точку, сносим всё кроме цифр и точки
  const normalized = value.replace(/,/g, '.').replace(/[^0-9.]/g, '');

  if (normalized === '') return '';

  // Разбиваем на целую/дробную часть, но допускаем промежуточное состояние "123."
  const parts = normalized.split('.');
  const integerPart = (parts.shift() ?? '').replace(/\D+/g, '');
  const decimalPartRaw = parts.join(''); // склеиваем все остаточные точки в дробную часть
  const decimalPart = decimalPartRaw.replace(/\D+/g, '');
  const endsWithDot = normalized.endsWith('.');

  // Не даём уходить в пустую строку, если человек уже ввёл что-то
  const safeInt = integerPart === '' ? '0' : integerPart;

  if (endsWithDot && decimalPart === '') {
    // позволяем "123." во время ввода
    return `${safeInt}.`;
  }
  if (decimalPart === '') {
    // нет дробной части -> просто целая
    return safeInt;
  }
  return `${safeInt}.${decimalPart}`;
};

// Подчистка по blur: убираем висящую точку и ведущие нули вроде "0001.20" -> "1.20", "000" -> ""
const normalizeOnBlurInteger = (value: string) => {
  const v = value.replace(/\D+/g, '');
  return v === '' ? '' : String(Number(v));
};

const normalizeOnBlurDecimal = (value: string) => {
  if (value.trim() === '') return '';
  let v = value.replace(/,/g, '.').replace(/[^0-9.]/g, '');

  // срезаем висящую точку в конце
  if (v.endsWith('.')) v = v.slice(0, -1);

  if (v === '' || v === '.') return '';
  const [i = '0', d = ''] = v.split('.');
  const intNorm = String(Number(i)); // убираем ведущие нули
  return d === '' ? intNorm : `${intNorm}.${d}`;
};

type MaskProps = {
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  pattern?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  value: string;
};

const makeIntegerMask = (value: string, setValue: (next: string) => void): MaskProps => ({
  inputMode: 'numeric',
  pattern: '[0-9]*',
  onKeyDown: blockExpAndSigns,
  value,
  onChange: (e) => setValue(sanitizeNumericInput(e.target.value, { allowDecimal: false })),
  onBlur: (e) => setValue(normalizeOnBlurInteger(e.target.value)),
});

const makeDecimalMask = (value: string, setValue: (next: string) => void): MaskProps => ({
  inputMode: 'decimal',
  // паттерн позволяет "." и цифры
  pattern: '[0-9.]*',
  onKeyDown: blockExpAndSigns,
  value,
  onChange: (e) => setValue(sanitizeNumericInput(e.target.value, { allowDecimal: true })),
  onBlur: (e) => setValue(normalizeOnBlurDecimal(e.target.value)),
});

const parseNumber = (value: string) => {
  if (value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const sanitizeStringList = (items?: string[]) =>
  (items ?? []).map((item) => item.trim()).filter((item) => item.length > 0);

const buildCreatePayload = (form: CreateProductFormState): ProductCreatePayload => {
  const payload: ProductCreatePayload = {
    name: form.name.trim(),
    category_id: form.categoryId,
    price_rub: Number(form.priceRub),
    dimensions: { shape: form.dimensions.shape as DimensionShape },
    delivery: {
      self_pickup_allowed: form.delivery.self_pickup_allowed,
    },
    setup: {
      self_setup_allowed: form.setup.self_setup_allowed,
    },
    rental: {
      base_period: form.rental.base_period || undefined,
    },
    visibility: {
      reservation_mode: form.visibility.reservation_mode || undefined,
      show_on_pifakit: form.visibility.show_on_pifakit,
      show_on_site: form.visibility.show_on_site,
      show_in_new: form.visibility.show_in_new,
      category_cover_on_home: form.visibility.category_cover_on_home,
    },
  };

  const complementaryIds = Array.from(
    new Set((form.complementaryProducts ?? []).map((item) => item.id))
  );
  payload.complementary_product_ids = complementaryIds;

  const features = sanitizeStringList(form.features);
  if (features.length) {
    payload.features = features;
  }

  if (form.lossCompensationRub.trim().length) {
    const value = Number(form.lossCompensationRub);
    if (!Number.isNaN(value)) {
      payload.loss_compensation_rub = value;
    }
  }

  if (form.color) {
    payload.color = form.color;
  }

  switch (form.dimensions.shape) {
    case 'circle__diameter':
      payload.dimensions.circle = {
        diameter_cm: Number(form.dimensions.circle.diameter_cm),
      };
      break;
    case 'line__length':
      payload.dimensions.line = {
        length_cm: Number(form.dimensions.line.length_cm),
      };
      break;
    case 'rectangle__length_width':
      payload.dimensions.rectangle = {
        length_cm: Number(form.dimensions.rectangle.length_cm),
        width_cm: Number(form.dimensions.rectangle.width_cm),
      };
      break;
    case 'cylinder__diameter_height':
      payload.dimensions.cylinder = {
        diameter_cm: Number(form.dimensions.cylinder.diameter_cm),
        height_cm: Number(form.dimensions.cylinder.height_cm),
      };
      break;
    case 'box__height_width_depth':
      payload.dimensions.box = {
        height_cm: Number(form.dimensions.box.height_cm),
        width_cm: Number(form.dimensions.box.width_cm),
        depth_cm: Number(form.dimensions.box.depth_cm),
      };
      break;
    default:
      break;
  }

  const cleaningDays = parseNumber(form.occupancy.cleaning_days);
  const insuranceReserve = parseNumber(form.occupancy.insurance_reserve_percent);
  if (cleaningDays !== undefined || insuranceReserve !== undefined) {
    payload.occupancy = {};
    if (cleaningDays !== undefined) {
      payload.occupancy.cleaning_days = cleaningDays;
    }
    if (insuranceReserve !== undefined) {
      payload.occupancy.insurance_reserve_percent = insuranceReserve;
    }
  }

  const volume = parseNumber(form.delivery.volume_cm3);
  const weight = parseNumber(form.delivery.weight_kg);
  if (volume !== undefined) {
    payload.delivery = payload.delivery ?? {
      self_pickup_allowed: form.delivery.self_pickup_allowed,
    };
    payload.delivery.volume_cm3 = volume;
  }
  if (weight !== undefined) {
    payload.delivery = payload.delivery ?? {
      self_pickup_allowed: form.delivery.self_pickup_allowed,
    };
    payload.delivery.weight_kg = weight;
  }
  if (form.delivery.transport_restriction) {
    payload.delivery = payload.delivery ?? {
      self_pickup_allowed: form.delivery.self_pickup_allowed,
    };
    payload.delivery.transport_restriction = form.delivery.transport_restriction;
  }

  const installMinutes = parseNumber(form.setup.install_minutes);
  const uninstallMinutes = parseNumber(form.setup.uninstall_minutes);
  if (
    installMinutes !== undefined ||
    uninstallMinutes !== undefined ||
    form.setup.installer_qualification ||
    form.setup.min_installers
  ) {
    payload.setup = payload.setup ?? { self_setup_allowed: form.setup.self_setup_allowed };
    if (installMinutes !== undefined) {
      payload.setup.install_minutes = installMinutes;
    }
    if (uninstallMinutes !== undefined) {
      payload.setup.uninstall_minutes = uninstallMinutes;
    }
    if (form.setup.installer_qualification) {
      payload.setup.installer_qualification = form.setup.installer_qualification;
    }
    if (form.setup.min_installers) {
      payload.setup.min_installers = Number(form.setup.min_installers);
    }
  }

  if (payload.rental?.base_period === undefined && form.rental.base_period) {
    payload.rental = { base_period: form.rental.base_period };
  }

  const slug = form.seo.slug.trim();
  const metaTitle = form.seo.meta_title.trim();
  const metaDescription = form.seo.meta_description.trim();
  const metaKeywords = sanitizeStringList(form.seo?.meta_keywords);
  if (slug || metaTitle || metaDescription || metaKeywords.length) {
    payload.seo = {};
    if (slug) {
      payload.seo.slug = slug;
    }
    if (metaTitle) {
      payload.seo.meta_title = metaTitle;
    }
    if (metaDescription) {
      payload.seo.meta_description = metaDescription;
    }
    if (metaKeywords.length) {
      payload.seo.meta_keywords = metaKeywords;
    }
  }

  return payload;
};

const ProductCard = ({
  product,
  categoryName,
  colorLabel,
  transportLabel,
  onEdit,
  onDelete,
  canManage,
}: {
  product: ProductListItem;
  categoryName: string | undefined;
  colorLabel: string | undefined;
  transportLabel: string | undefined;
  onEdit?: (product: ProductListItem) => void;
  onDelete?: (product: ProductListItem) => void;
  canManage: boolean;
}) => {
  return (
    <article
      style={{
        display: 'flex',
        gap: '16px',
        padding: '20px',
        borderRadius: '16px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
      }}
    >
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'var(--color-surface-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {product.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumbnail_url}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Нет фото</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h2 style={{ fontSize: '1.125rem', margin: 0 }}>{product.name}</h2>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            {categoryName ?? 'Без категории'}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <Badge tone="success">{formatPrice(product.price_rub)}</Badge>
          {colorLabel ? <Badge tone="info">Цвет: {colorLabel}</Badge> : null}
          {transportLabel ? <Badge tone="info">Транспорт: {transportLabel}</Badge> : null}
          <Badge tone={product.delivery.self_pickup_allowed ? 'success' : 'info'}>
            {product.delivery.self_pickup_allowed ? 'Самовывоз доступен' : 'Только доставка'}
          </Badge>
        </div>

        {canManage ? (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Button type="button" variant="ghost" onClick={() => onEdit?.(product)}>
              Редактировать
            </Button>
            <Button type="button" variant="danger" onClick={() => onDelete?.(product)}>
              Удалить
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
};

export default function ProductsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedColor, setSelectedColor] = useState<ProductListQuery['color'] | ''>('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selfPickup, setSelfPickup] = useState('');
  const [ordering, setOrdering] = useState<ProductListQuery['ordering']>('-created_at');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateProductFormState>(() =>
    createEmptyProductForm()
  );
  const [createTouched, setCreateTouched] = useState(false);
  const [pageNotification, setPageNotification] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<ProductFormMode>('create');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productImages, setProductImages] = useState<ProductFormImage[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductListItem | null>(null);
  const [isComplementaryPickerVisible, setIsComplementaryPickerVisible] = useState(false);
  const [complementarySearch, setComplementarySearch] = useState('');
  const complementaryLoadMoreRef = useRef<HTMLDivElement | null>(null);

  const canManageProducts = usePermission('products_add_product');
  const queryClient = useQueryClient();

  const baseParams = useMemo<ProductListQuery>(
    () => ({
      limit: 20,
      q: searchTerm || undefined,
      color: (selectedColor || undefined) as ProductListQuery['color'] | undefined,
      category_id: selectedCategory || undefined,
      self_pickup: selfPickup === '' ? undefined : selfPickup === 'true',
      ordering,
    }),
    [ordering, searchTerm, selectedCategory, selectedColor, selfPickup]
  );

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useInfiniteProductsQuery(baseParams);

  const complementaryQueryParams = useMemo<ProductListQuery>(
    () => ({
      limit: 20,
      q: complementarySearch.trim() || undefined,
      ordering: 'name',
    }),
    [complementarySearch]
  );

  const {
    data: complementaryProductPages,
    fetchNextPage: fetchNextComplementaryProducts,
    hasNextPage: hasMoreComplementaryProducts = false,
    isFetchingNextPage: isFetchingMoreComplementaryProducts,
    isLoading: isLoadingComplementaryProducts,
  } = useInfiniteProductsQuery(complementaryQueryParams);

  const complementaryProductsOptions = useMemo(() => {
    const fetched = complementaryProductPages?.pages.flatMap((page) => page.results) ?? [];
    const currentId = formMode === 'edit' ? editingProductId : null;
    const seen = new Set<string>();
    return fetched.filter((product) => {
      if (product.id === currentId) {
        return false;
      }
      if (seen.has(product.id)) {
        return false;
      }
      seen.add(product.id);
      return true;
    });
  }, [complementaryProductPages, formMode, editingProductId]);

  const selectedComplementaryIds = useMemo(
    () => new Set(createForm.complementaryProducts.map((item) => item.id)),
    [createForm.complementaryProducts]
  );

  const { data: enumsData } = useQuery({
    queryKey: ['products', 'enums'],
    queryFn: productsApi.enums,
    staleTime: 5 * 60 * 1000,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['products', 'categories'],
    queryFn: productsApi.categories,
    staleTime: 5 * 60 * 1000,
  });

  const categoryOptions = useMemo(
    () => (categoriesData ? flattenCategories(categoriesData) : []),
    [categoriesData]
  );
  const categoryNameMap = useMemo(
    () => (categoriesData ? buildCategoryNameMap(categoriesData) : {}),
    [categoriesData]
  );
  const colorOptions = enumsData?.colors ?? [];
  const colorLabelMap = useMemo(() => createEnumMap(enumsData?.colors), [enumsData]);
  const transportLabelMap = useMemo(
    () => createEnumMap(enumsData?.transport_restrictions),
    [enumsData]
  );
  const {
    data: editingProduct,
    isLoading: isEditingProductLoading,
    isError: isEditingProductError,
    error: editingProductError,
  } = useQuery({
    queryKey: ['products', 'detail', editingProductId, 'form'],
    queryFn: () => {
      if (!editingProductId) {
        throw new Error('productId is not set');
      }
      return productsApi.details(
        editingProductId,
        'images,seo,dimensions,complementary_products'
      );
    },
    enabled: formMode === 'edit' && Boolean(editingProductId) && isProductModalOpen,
  });
  const createFormDefaults = useMemo(
    () => ({
      rentalBasePeriod: enumsData?.rental_base_periods?.[0]?.value as RentalBasePeriod | undefined,
      reservationMode: enumsData?.reservation_modes?.[0]?.value as ReservationMode | undefined,
      transportRestriction: enumsData?.transport_restrictions?.[0]?.value as
        | TransportRestriction
        | undefined,
      installerQualification: enumsData?.installer_qualifications?.[0]?.value as
        | InstallerQualification
        | undefined,
      minInstallers: 1,
    }),
    [enumsData]
  );
  const createProductMutation = useMutation<ProductCreateResponse, Error, ProductCreatePayload>({
    mutationFn: (payload: ProductCreatePayload) => productsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
  const updateProductMutation = useMutation<
    ProductDetail,
    Error,
    { productId: string; payload: ProductUpdatePayload }
  >({
    mutationFn: ({ productId, payload }) => productsApi.update(productId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', 'detail', variables.productId] });
    },
  });
  const deleteProductMutation = useMutation<void, Error, string>({
    mutationFn: (productId: string) => productsApi.remove(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
  const isCreatingProduct = createProductMutation.status === 'pending';
  const isUpdatingProduct = updateProductMutation.status === 'pending';
  const isDeletingProduct = deleteProductMutation.status === 'pending';
  const isSubmittingProduct = formMode === 'create' ? isCreatingProduct : isUpdatingProduct;
  const productFormErrorMessage = (() => {
    const errorInstance =
      formMode === 'create' ? createProductMutation.error : updateProductMutation.error;
    if (errorInstance instanceof Error) {
      return errorInstance.message;
    }
    return formMode === 'create'
      ? 'Не удалось создать товар. Попробуйте позже.'
      : 'Не удалось обновить товар. Попробуйте позже.';
  })();
  const productMutation = formMode === 'create' ? createProductMutation : updateProductMutation;
  const isEditReady =
    formMode === 'edit'
      ? Boolean(editingProduct) && !isEditingProductLoading && !isEditingProductError
      : true;
  const deleteProductErrorMessage =
    deleteProductMutation.error instanceof Error
      ? deleteProductMutation.error.message
      : 'Не удалось удалить товар. Попробуйте позже.';

  const products = useMemo(() => data?.pages.flatMap((page) => page.results) ?? [], [data]);

  const shapeOptions = enumsData?.shapes ?? [];
  const installerQualificationOptions = enumsData?.installer_qualifications ?? [];
  const reservationModeOptions = enumsData?.reservation_modes ?? [];
  const rentalBasePeriodOptions = enumsData?.rental_base_periods ?? [];
  const transportRestrictionOptions = enumsData?.transport_restrictions ?? [];
  const minInstallersOptions = [1, 2, 3, 4];

  const trimmedCreateName = createForm.name.trim();
  const createPriceValue = Number(createForm.priceRub);
  const isCreatePriceValid =
    createForm.priceRub.trim() !== '' && Number.isFinite(createPriceValue) && createPriceValue >= 0;

  const lossCompensationValue = Number(createForm.lossCompensationRub);
  const isLossCompensationValid =
    createForm.lossCompensationRub.trim() === '' ||
    (!Number.isNaN(lossCompensationValue) && lossCompensationValue >= 0);

  const dimensionsShape = createForm.dimensions.shape;
  const circleDiameterValue = Number(createForm.dimensions.circle.diameter_cm);
  const isCircleDiameterValid =
    dimensionsShape !== 'circle__diameter' ||
    (createForm.dimensions.circle.diameter_cm.trim() !== '' &&
      !Number.isNaN(circleDiameterValue) &&
      circleDiameterValue > 0);
  const lineLengthValue = Number(createForm.dimensions.line.length_cm);
  const isLineLengthValid =
    dimensionsShape !== 'line__length' ||
    (createForm.dimensions.line.length_cm.trim() !== '' &&
      !Number.isNaN(lineLengthValue) &&
      lineLengthValue > 0);
  const rectangleLengthValue = Number(createForm.dimensions.rectangle.length_cm);
  const rectangleWidthValue = Number(createForm.dimensions.rectangle.width_cm);
  const isRectangleLengthValid =
    dimensionsShape !== 'rectangle__length_width' ||
    (createForm.dimensions.rectangle.length_cm.trim() !== '' &&
      !Number.isNaN(rectangleLengthValue) &&
      rectangleLengthValue > 0);
  const isRectangleWidthValid =
    dimensionsShape !== 'rectangle__length_width' ||
    (createForm.dimensions.rectangle.width_cm.trim() !== '' &&
      !Number.isNaN(rectangleWidthValue) &&
      rectangleWidthValue > 0);
  const cylinderDiameterValue = Number(createForm.dimensions.cylinder.diameter_cm);
  const cylinderHeightValue = Number(createForm.dimensions.cylinder.height_cm);
  const isCylinderDiameterValid =
    dimensionsShape !== 'cylinder__diameter_height' ||
    (createForm.dimensions.cylinder.diameter_cm.trim() !== '' &&
      !Number.isNaN(cylinderDiameterValue) &&
      cylinderDiameterValue > 0);
  const isCylinderHeightValid =
    dimensionsShape !== 'cylinder__diameter_height' ||
    (createForm.dimensions.cylinder.height_cm.trim() !== '' &&
      !Number.isNaN(cylinderHeightValue) &&
      cylinderHeightValue > 0);
  const boxHeightValue = Number(createForm.dimensions.box.height_cm);
  const boxWidthValue = Number(createForm.dimensions.box.width_cm);
  const boxDepthValue = Number(createForm.dimensions.box.depth_cm);
  const isBoxHeightValid =
    dimensionsShape !== 'box__height_width_depth' ||
    (createForm.dimensions.box.height_cm.trim() !== '' &&
      !Number.isNaN(boxHeightValue) &&
      boxHeightValue > 0);
  const isBoxWidthValid =
    dimensionsShape !== 'box__height_width_depth' ||
    (createForm.dimensions.box.width_cm.trim() !== '' &&
      !Number.isNaN(boxWidthValue) &&
      boxWidthValue > 0);
  const isBoxDepthValid =
    dimensionsShape !== 'box__height_width_depth' ||
    (createForm.dimensions.box.depth_cm.trim() !== '' &&
      !Number.isNaN(boxDepthValue) &&
      boxDepthValue > 0);
  const isDimensionsValid =
    Boolean(dimensionsShape) &&
    isCircleDiameterValid &&
    isLineLengthValid &&
    isRectangleLengthValid &&
    isRectangleWidthValid &&
    isCylinderDiameterValid &&
    isCylinderHeightValid &&
    isBoxHeightValid &&
    isBoxWidthValid &&
    isBoxDepthValid;

  const occupancyCleaningValue = parseNumber(createForm.occupancy.cleaning_days);
  const isOccupancyCleaningValid =
    createForm.occupancy.cleaning_days.trim() === '' ||
    (occupancyCleaningValue !== undefined && occupancyCleaningValue >= 0);
  const occupancyInsuranceValue = parseNumber(createForm.occupancy.insurance_reserve_percent);
  const isOccupancyInsuranceValid =
    createForm.occupancy.insurance_reserve_percent.trim() === '' ||
    (occupancyInsuranceValue !== undefined &&
      occupancyInsuranceValue >= 0 &&
      occupancyInsuranceValue <= 100);
  const isOccupancyValid = isOccupancyCleaningValid && isOccupancyInsuranceValid;

  const deliveryVolumeValue = parseNumber(createForm.delivery.volume_cm3);
  const isDeliveryVolumeValid =
    createForm.delivery.volume_cm3.trim() !== '' &&
    deliveryVolumeValue !== undefined &&
    deliveryVolumeValue > 0;
  const deliveryWeightValue = parseNumber(createForm.delivery.weight_kg);
  const isDeliveryWeightValid =
    createForm.delivery.weight_kg.trim() !== '' &&
    deliveryWeightValue !== undefined &&
    deliveryWeightValue > 0;
  const isDeliveryTransportValid = createForm.delivery.transport_restriction !== '';
  const isDeliveryValid =
    isDeliveryVolumeValid && isDeliveryWeightValid && isDeliveryTransportValid;

  const installMinutesValue = parseNumber(createForm.setup.install_minutes);
  const isInstallMinutesValid =
    createForm.setup.install_minutes.trim() !== '' &&
    installMinutesValue !== undefined &&
    installMinutesValue >= 0;
  const uninstallMinutesValue = parseNumber(createForm.setup.uninstall_minutes);
  const isUninstallMinutesValid =
    createForm.setup.uninstall_minutes.trim() !== '' &&
    uninstallMinutesValue !== undefined &&
    uninstallMinutesValue >= 0;
  const minInstallersValue = Number(createForm.setup.min_installers);
  const isMinInstallersValid =
    createForm.setup.min_installers.trim() !== '' &&
    !Number.isNaN(minInstallersValue) &&
    minInstallersOptions.includes(minInstallersValue);
  const isInstallerQualificationValid = createForm.setup.installer_qualification !== '';
  const isSetupValid =
    isInstallMinutesValid &&
    isUninstallMinutesValid &&
    isMinInstallersValid &&
    isInstallerQualificationValid;

  const isRentalBasePeriodValid = Boolean(createForm.rental.base_period);
  const isReservationModeValid = Boolean(createForm.visibility.reservation_mode);

  const isCreateFormValid =
    Boolean(trimmedCreateName && createForm.categoryId) &&
    isCreatePriceValid &&
    isLossCompensationValid &&
    isDimensionsValid &&
    isOccupancyValid &&
    isDeliveryValid &&
    isSetupValid &&
    isRentalBasePeriodValid &&
    isReservationModeValid;

  const createNameError =
    createTouched && !trimmedCreateName ? 'Введите название товара' : undefined;
  const createCategoryError =
    createTouched && !createForm.categoryId ? 'Выберите категорию' : undefined;
  const createPriceError =
    createTouched && !isCreatePriceValid ? 'Введите стоимость в рублях (0 или больше)' : undefined;
  const createLossCompensationError =
    createTouched && !isLossCompensationValid
      ? 'Введите компенсацию за потерю (0 или больше)'
      : undefined;
  const createDimensionsShapeError =
    createTouched && !dimensionsShape ? 'Выберите форму габаритов' : undefined;
  const createCircleDiameterError =
    createTouched && dimensionsShape === 'circle__diameter' && !isCircleDiameterValid
      ? 'Введите диаметр (см) больше 0'
      : undefined;
  const createLineLengthError =
    createTouched && dimensionsShape === 'line__length' && !isLineLengthValid
      ? 'Введите длину (см) больше 0'
      : undefined;
  const createRectangleLengthError =
    createTouched && dimensionsShape === 'rectangle__length_width' && !isRectangleLengthValid
      ? 'Введите длину (см) больше 0'
      : undefined;
  const createRectangleWidthError =
    createTouched && dimensionsShape === 'rectangle__length_width' && !isRectangleWidthValid
      ? 'Введите ширину (см) больше 0'
      : undefined;
  const createCylinderDiameterError =
    createTouched && dimensionsShape === 'cylinder__diameter_height' && !isCylinderDiameterValid
      ? 'Введите диаметр (см) больше 0'
      : undefined;
  const createCylinderHeightError =
    createTouched && dimensionsShape === 'cylinder__diameter_height' && !isCylinderHeightValid
      ? 'Введите высоту (см) больше 0'
      : undefined;
  const createBoxHeightError =
    createTouched && dimensionsShape === 'box__height_width_depth' && !isBoxHeightValid
      ? 'Введите высоту (см) больше 0'
      : undefined;
  const createBoxWidthError =
    createTouched && dimensionsShape === 'box__height_width_depth' && !isBoxWidthValid
      ? 'Введите ширину (см) больше 0'
      : undefined;
  const createBoxDepthError =
    createTouched && dimensionsShape === 'box__height_width_depth' && !isBoxDepthValid
      ? 'Введите глубину (см) больше 0'
      : undefined;
  const createOccupancyCleaningError =
    createTouched && createForm.occupancy.cleaning_days.trim() !== '' && !isOccupancyCleaningValid
      ? 'Введите количество дней (0 или больше)'
      : undefined;
  const createOccupancyInsuranceError =
    createTouched &&
    createForm.occupancy.insurance_reserve_percent.trim() !== '' &&
    !isOccupancyInsuranceValid
      ? 'Введите страховой резерв в диапазоне 0–100%'
      : undefined;
  const createDeliveryVolumeError =
    createTouched && !isDeliveryVolumeValid ? 'Введите объём (см³) больше 0' : undefined;
  const createDeliveryWeightError =
    createTouched && !isDeliveryWeightValid ? 'Введите массу (кг) больше 0' : undefined;
  const createDeliveryTransportError =
    createTouched && !isDeliveryTransportValid ? 'Выберите ограничение по транспорту' : undefined;
  const createInstallMinutesError =
    createTouched && !isInstallMinutesValid
      ? 'Введите время монтажа в минутах (0 или больше)'
      : undefined;
  const createUninstallMinutesError =
    createTouched && !isUninstallMinutesValid
      ? 'Введите время демонтажа в минутах (0 или больше)'
      : undefined;
  const createInstallerQualificationError =
    createTouched && !isInstallerQualificationValid ? 'Выберите квалификацию сетапёров' : undefined;
  const createMinInstallersError =
    createTouched && !isMinInstallersValid ? 'Выберите требуемое число сетапёров' : undefined;
  const createRentalBasePeriodError =
    createTouched && !isRentalBasePeriodValid ? 'Выберите базовый период аренды' : undefined;
  const createReservationModeError =
    createTouched && !isReservationModeValid ? 'Выберите режим бронирования' : undefined;
  const canAddFeature = createForm.featureDraft.trim().length > 0;
  const canAddMetaKeyword = createForm.metaKeywordDraft.trim().length > 0;

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) {
        fetchNextPage();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  };

  const handleReset = () => {
    setSearchInput('');
    setSearchTerm('');
    setSelectedColor('');
    setSelectedCategory('');
    setSelfPickup('');
    setOrdering('-created_at');
  };

  const cleanupImagePreviews = (images: ProductFormImage[]) => {
    images.forEach((image) => {
      if (image.file) {
        URL.revokeObjectURL(image.previewUrl);
      }
    });
  };

  const normalizePrimary = (images: ProductFormImage[]): ProductFormImage[] => {
    if (images.length === 0) {
      return [];
    }
    const firstActiveIndex = images.findIndex((img) => !img.removed);
    if (firstActiveIndex === -1) {
      return images.map((img) => ({ ...img, isPrimary: false }));
    }
    const primaryIndex = images.findIndex((img) => !img.removed && img.isPrimary);
    const targetIndex = primaryIndex !== -1 ? primaryIndex : firstActiveIndex;
    return images.map((img, index) => ({
      ...img,
      isPrimary: !img.removed && index === targetIndex,
    }));
  };

  const createImageId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `image-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

  const openCreateModal = () => {
    if (!canManageProducts) {
      return;
    }
    cleanupImagePreviews(productImages);
    setProductImages([]);
    setFormMode('create');
    setEditingProductId(null);
    setCreateForm(createEmptyProductForm(createFormDefaults));
    setCreateTouched(false);
    createProductMutation.reset();
    updateProductMutation.reset();
    setComplementarySearch('');
    setIsComplementaryPickerVisible(false);
    setIsProductModalOpen(true);
  };

  const openEditModal = (product: ProductListItem) => {
    if (!canManageProducts) {
      return;
    }
    cleanupImagePreviews(productImages);
    setProductImages([]);
    setFormMode('edit');
    setEditingProductId(product.id);
    setCreateTouched(false);
    createProductMutation.reset();
    updateProductMutation.reset();
    setComplementarySearch('');
    setIsComplementaryPickerVisible(false);
    setIsProductModalOpen(true);
  };

  const openDeleteModal = (product: ProductListItem) => {
    if (!canManageProducts) {
      return;
    }
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
    deleteProductMutation.reset();
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setProductToDelete(null);
    deleteProductMutation.reset();
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) {
      return;
    }
    try {
      await deleteProductMutation.mutateAsync(productToDelete.id);
      setPageNotification(`Товар «${productToDelete.name}» удалён.`);
      closeDeleteModal();
    } catch (error) {
      // Ошибка отобразится в модальном окне удаления
    }
  };

  useEffect(() => {
    if (formMode !== 'edit' || !editingProduct) {
      return;
    }
    setCreateForm(createFormFromProduct(editingProduct));
    setCreateTouched(false);
    setProductImages(mapProductImagesToForm(editingProduct.images));
  }, [formMode, editingProduct]);

  useEffect(() => {
    if (!isComplementaryPickerVisible || !hasMoreComplementaryProducts) {
      return;
    }
    const element = complementaryLoadMoreRef.current;
    if (!element) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingMoreComplementaryProducts) {
        fetchNextComplementaryProducts();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [
    isComplementaryPickerVisible,
    hasMoreComplementaryProducts,
    fetchNextComplementaryProducts,
    isFetchingMoreComplementaryProducts,
  ]);

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setCreateTouched(false);
    cleanupImagePreviews(productImages);
    setProductImages([]);
    setCreateForm(createEmptyProductForm(createFormDefaults));
    setFormMode('create');
    setEditingProductId(null);
    createProductMutation.reset();
    updateProductMutation.reset();
    setComplementarySearch('');
    setIsComplementaryPickerVisible(false);
  };

  const handleDimensionShapeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const shape = event.target.value as DimensionShape | '';
    setCreateForm((prev) => ({
      ...prev,
      dimensions: {
        shape,
        circle: { diameter_cm: '' },
        line: { length_cm: '' },
        rectangle: { length_cm: '', width_cm: '' },
        cylinder: { diameter_cm: '', height_cm: '' },
        box: { height_cm: '', width_cm: '', depth_cm: '' },
      },
    }));
  };

  const handleFeatureDraftChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCreateForm((prev) => ({ ...prev, featureDraft: event.target.value }));
  };

  const handleComplementarySearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setComplementarySearch(event.target.value);
  };

  const toggleComplementaryPicker = () => {
    setIsComplementaryPickerVisible((prev) => {
      const next = !prev;
      if (!prev) {
        setComplementarySearch('');
      }
      return next;
    });
  };

  const handleToggleComplementaryProduct = (product: ProductListItem) => {
    if (formMode === 'edit' && editingProductId && product.id === editingProductId) {
      return;
    }
    setCreateForm((prev) => {
      const exists = prev.complementaryProducts.some((item) => item.id === product.id);
      if (exists) {
        return {
          ...prev,
          complementaryProducts: prev.complementaryProducts.filter(
            (item) => item.id !== product.id
          ),
        };
      }
      return {
        ...prev,
        complementaryProducts: [...prev.complementaryProducts, { id: product.id, name: product.name }],
      };
    });
  };

  const handleRemoveComplementaryProduct = (productId: string) => {
    setCreateForm((prev) => ({
      ...prev,
      complementaryProducts: prev.complementaryProducts.filter((item) => item.id !== productId),
    }));
  };

  const handleClearComplementaryProducts = () => {
    setCreateForm((prev) => ({ ...prev, complementaryProducts: [] }));
  };

  const handleAddFeature = () => {
    const nextFeature = createForm.featureDraft.trim();
    if (!nextFeature) {
      return;
    }
    setCreateForm((prev) => ({
      ...prev,
      features: [...prev.features, nextFeature],
      featureDraft: '',
    }));
  };

  const handleFeatureChange = (index: number, value: string) => {
    setCreateForm((prev) => ({
      ...prev,
      features: prev.features.map((feature, featureIndex) =>
        featureIndex === index ? value : feature
      ),
    }));
  };

  const handleRemoveFeature = (index: number) => {
    setCreateForm((prev) => ({
      ...prev,
      features: prev.features.filter((_, featureIndex) => featureIndex !== index),
    }));
  };

  const handleMetaKeywordDraftChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCreateForm((prev) => ({ ...prev, metaKeywordDraft: event.target.value }));
  };

  const handleAddMetaKeyword = () => {
    const keyword = createForm.metaKeywordDraft.trim();
    if (!keyword) {
      return;
    }
    setCreateForm((prev) => ({
      ...prev,
      seo: { ...prev.seo, meta_keywords: [...prev.seo.meta_keywords, keyword] },
      metaKeywordDraft: '',
    }));
  };

  const handleMetaKeywordChange = (index: number, value: string) => {
    setCreateForm((prev) => ({
      ...prev,
      seo: {
        ...prev.seo,
        meta_keywords: prev.seo.meta_keywords.map((keyword, keywordIndex) =>
          keywordIndex === index ? value : keyword
        ),
      },
    }));
  };

  const handleRemoveMetaKeyword = (index: number) => {
    setCreateForm((prev) => ({
      ...prev,
      seo: {
        ...prev.seo,
        meta_keywords: prev.seo.meta_keywords.filter((_, keywordIndex) => keywordIndex !== index),
      },
    }));
  };

  const handleImagesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    if (!files || files.length === 0) {
      return;
    }
    const nextImages = Array.from(files).map((file) => ({
      id: createImageId(),
      file,
      previewUrl: URL.createObjectURL(file),
      isPrimary: false,
    }));
    setProductImages((prev) =>
      normalizePrimary([...prev.map((image) => ({ ...image })), ...nextImages])
    );
    event.target.value = '';
  };

  const handleRemoveImage = (id: string) => {
    setProductImages((prev) => {
      const next: ProductFormImage[] = [];
      prev.forEach((image) => {
        if (image.id !== id) {
          next.push({ ...image });
          return;
        }
        if (image.remoteId) {
          next.push({ ...image, removed: true, isPrimary: false });
        } else {
          if (image.file) {
            URL.revokeObjectURL(image.previewUrl);
          }
        }
      });
      return normalizePrimary(next);
    });
  };

  const handleSetPrimaryImage = (id: string) => {
    setProductImages((prev) => {
      const targetIndex = prev.findIndex((image) => image.id === id && !image.removed);
      if (targetIndex === -1) {
        return prev;
      }
      const target = { ...prev[targetIndex], isPrimary: true };
      const before = prev.slice(0, targetIndex).map((image) => ({ ...image, isPrimary: false }));
      const after = prev.slice(targetIndex + 1).map((image) => ({ ...image, isPrimary: false }));
      const activeAfter = after.filter((image) => !image.removed);
      const activeBefore = before.filter((image) => !image.removed);
      const removed = [...before, ...after].filter((image) => image.removed);
      const ordered: ProductFormImage[] = [target, ...activeBefore, ...activeAfter, ...removed];
      return normalizePrimary(ordered);
    });
  };

  const handleProductSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateTouched(true);
    if (!isCreateFormValid) {
      return;
    }
    if (formMode === 'edit' && !isEditReady) {
      return;
    }
    const payload = buildCreatePayload(createForm);
    const normalizedImages = normalizePrimary(productImages);
    const activeImages = normalizedImages.filter((image) => !image.removed);

    try {
      if (formMode === 'create') {
        const response = await createProductMutation.mutateAsync(payload);
        if (activeImages.length) {
          const uploadPayload = activeImages
            .filter((image): image is ProductFormImage & { file: File } => Boolean(image.file))
            .map((image, index) => ({ file: image.file!, position: index + 1 }));
          if (uploadPayload.length) {
            await productsApi.uploadImages(response.id, uploadPayload);
          }
        }
        setPageNotification(`Товар «${payload.name}» создан. ID: ${response.id}.`);
      } else if (formMode === 'edit' && editingProductId) {
        await updateProductMutation.mutateAsync({ productId: editingProductId, payload });

        const removedImages = normalizedImages.filter((image) => image.removed && image.remoteId);
        if (removedImages.length) {
          await Promise.all(
            removedImages.map((image) =>
              image.remoteId
                ? productsApi.deleteImage(editingProductId, image.remoteId)
                : Promise.resolve()
            )
          );
        }

        const newImages = activeImages.filter((image) => image.file);
        const uploadedIds = new Map<string, string>();
        if (newImages.length) {
          const uploadPayload = newImages.map((image) => ({
            file: image.file!,
            position: activeImages.findIndex((item) => item.id === image.id) + 1,
          }));
          const uploaded = await productsApi.uploadImages(editingProductId, uploadPayload);
          uploaded.forEach((item, index) => {
            const source = newImages[index];
            uploadedIds.set(source.id, item.id);
          });
        }

        const finalOrder = activeImages
          .map((image, index) => ({
            id: image.remoteId ?? uploadedIds.get(image.id),
            position: index + 1,
          }))
          .filter((item): item is { id: string; position: number } => Boolean(item.id));

        if (finalOrder.length) {
          await productsApi.reorderImages(editingProductId, { order: finalOrder });
        }

        setPageNotification(`Товар «${payload.name}» обновлён.`);
      }

      closeProductModal();
    } catch (error) {
      // Ошибка отображается через состояние мутации
    }
  };

  return (
    <RoleGuard allow={['adminpanel_view_products', 'inventory_view_inventoryitem']}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '24px',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h1>Каталог товаров</h1>
            <p style={{ color: 'var(--color-text-muted)', maxWidth: '48rem' }}>
              Реальный прайс-лист с поддержкой поиска, фильтрации и бесконечной прокрутки. Выбирайте
              товары по категории, цвету и доступности самовывоза.
            </p>
          </div>
          {canManageProducts ? (
            <Button iconLeft="plus" onClick={openCreateModal}>
              Новый товар
            </Button>
          ) : null}
        </header>

        {pageNotification ? (
          <Alert tone="success" title="Товар создан">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span>{pageNotification}</span>
              <Button variant="ghost" type="button" onClick={() => setPageNotification(null)}>
                Скрыть
              </Button>
            </div>
          </Alert>
        ) : null}

        <section
          style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'var(--color-surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              alignItems: 'end',
            }}
          >
            <Input
              label="Поиск"
              placeholder="Название товара"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Select
              label="Категория"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              <option value="">Все категории</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              label="Цвет"
              value={selectedColor ?? ''}
              onChange={(event) =>
                setSelectedColor(event.target.value as ProductListQuery['color'] | '')
              }
            >
              <option value="">Все цвета</option>
              {colorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              label="Самовывоз"
              value={selfPickup}
              onChange={(event) => setSelfPickup(event.target.value)}
            >
              {selfPickupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              label="Сортировка"
              value={ordering ?? '-created_at'}
              onChange={(event) => setOrdering(event.target.value as ProductListQuery['ordering'])}
            >
              {orderingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button type="submit" variant="primary">
                Применить
              </Button>
              <Button type="button" variant="ghost" onClick={handleReset}>
                Сбросить
              </Button>
            </div>
          </form>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isLoading ? <Spinner label="Загружаем товары" /> : null}

          {isError ? (
            <Alert tone="danger" title="Не удалось загрузить товары">
              {error instanceof Error
                ? error.message
                : 'Попробуйте обновить страницу немного позже.'}
            </Alert>
          ) : null}

          {!isLoading && !isError && products.length === 0 ? (
            <Alert tone="info" title="Товары не найдены">
              Попробуйте скорректировать параметры поиска.
            </Alert>
          ) : null}

          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categoryName={categoryNameMap[product.category_id ?? '']}
              colorLabel={product.color ? colorLabelMap[product.color] : undefined}
              transportLabel={
                product.delivery.transport_restriction
                  ? transportLabelMap[product.delivery.transport_restriction]
                  : undefined
              }
              onEdit={openEditModal}
              onDelete={openDeleteModal}
              canManage={canManageProducts}
            />
          ))}

          <div ref={loadMoreRef} />

          {isFetchingNextPage ? <Spinner label="Загружаем ещё" /> : null}

          {hasNextPage && !isFetchingNextPage ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              Загрузить ещё
            </Button>
          ) : null}

          {isFetching && !isLoading && !isFetchingNextPage ? <Spinner /> : null}
        </section>
      </div>

      <Modal
        open={isProductModalOpen}
        title={formMode === 'create' ? 'Новый товар' : 'Редактирование товара'}
        onClose={closeProductModal}
      >
        <form
          onSubmit={handleProductSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            maxHeight: '70vh',
            padding: '8px 0 0',
          }}
        >
          {productMutation.isError ? (
            <Alert
              tone="danger"
              title={
                formMode === 'create' ? 'Не удалось создать товар' : 'Не удалось обновить товар'
              }
            >
              {productFormErrorMessage}
            </Alert>
          ) : null}

          {formMode === 'edit' && isEditingProductLoading ? (
            <div style={{ padding: '16px' }}>
              <Spinner label="Загружаем данные товара" />
            </div>
          ) : formMode === 'edit' && isEditingProductError ? (
            <Alert tone="danger" title="Не удалось загрузить данные товара">
              {editingProductError instanceof Error
                ? editingProductError.message
                : 'Попробуйте закрыть окно и повторить попытку.'}
            </Alert>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
                overflowY: 'auto',
                paddingRight: '8px',
              }}
            >
              <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0 }}>Основные данные</h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <Input
                    label="Название товара"
                    placeholder="Например, Скатерть Амори бархатная"
                    value={createForm.name}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    error={createNameError}
                  />
                  <Select
                    label="Категория"
                    value={createForm.categoryId}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, categoryId: event.target.value }))
                    }
                    error={createCategoryError}
                  >
                    <option value="">Выберите категорию</option>
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Стоимость, ₽"
                    /* type можно оставить number, но лучше text, чтобы убрать спиннеры:
                         type="text" */
                    type="text"
                    {...makeIntegerMask(createForm.priceRub, (next) =>
                      setCreateForm((prev) => ({ ...prev, priceRub: next }))
                    )}
                    helperText="Минимальное значение — 0 ₽."
                    error={createPriceError}
                  />
                  <Input
                    label="Компенсация за потерю, ₽"
                    type="text"
                    {...makeIntegerMask(createForm.lossCompensationRub, (next) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        lossCompensationRub: next,
                      }))
                    )}
                    helperText="Необязательное поле."
                    error={createLossCompensationError}
                  />
                  <Select
                    label="Цвет"
                    value={createForm.color ?? ''}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        color: (event.target.value as ProductColor | '') || '',
                      }))
                    }
                  >
                    <option value="">Без цвета</option>
                    {colorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <FormField label="Особенности" description="Добавьте короткие преимущества товара.">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {createForm.features.map((feature, index) => (
                      <div
                        key={`feature-${index}`}
                        style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}
                      >
                        <Input
                          value={feature}
                          placeholder="Описание особенности"
                          onChange={(event) => handleFeatureChange(index, event.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleRemoveFeature(index)}
                        >
                          Удалить
                        </Button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <Input
                        value={createForm.featureDraft}
                        onChange={handleFeatureDraftChange}
                        placeholder="Новая особенность"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleAddFeature}
                        disabled={!canAddFeature}
                      >
                        Добавить
                      </Button>
                    </div>
                  </div>
                </FormField>

                <FormField
                  label="Дополняющие изделия"
                  description="Выберите товары, которые будут рекомендованы вместе с этим изделием."
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {createForm.complementaryProducts.length ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {createForm.complementaryProducts.map((product) => (
                          <div
                            key={product.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '6px 12px',
                              borderRadius: '999px',
                              background: 'var(--color-surface-muted)',
                            }}
                          >
                            <span style={{ fontSize: '0.875rem' }}>{product.name}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveComplementaryProduct(product.id)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--color-text-muted)',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                lineHeight: 1,
                              }}
                              aria-label={`Удалить ${product.name}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        Дополняющие изделия не выбраны.
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <Button type="button" variant="ghost" onClick={toggleComplementaryPicker}>
                        {isComplementaryPickerVisible ? 'Скрыть' : 'Добавить'}
                      </Button>
                      {createForm.complementaryProducts.length ? (
                        <Button type="button" variant="ghost" onClick={handleClearComplementaryProducts}>
                          Очистить
                        </Button>
                      ) : null}
                    </div>
                    {isComplementaryPickerVisible ? (
                      <Accordion title="Выбор дополняющих изделий" defaultOpen>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <Input
                            placeholder="Поиск изделия"
                            value={complementarySearch}
                            onChange={handleComplementarySearchChange}
                          />
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              maxHeight: 260,
                              overflow: 'auto',
                            }}
                          >
                            {isLoadingComplementaryProducts ? (
                              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                                <Spinner />
                              </div>
                            ) : complementaryProductsOptions.length ? (
                              complementaryProductsOptions.map((product) => {
                                const isSelected = selectedComplementaryIds.has(product.id);
                                return (
                                  <Button
                                    key={product.id}
                                    type="button"
                                    variant={isSelected ? 'primary' : 'ghost'}
                                    onClick={() => handleToggleComplementaryProduct(product)}
                                    style={{ justifyContent: 'flex-start' }}
                                  >
                                    {product.name}
                                  </Button>
                                );
                              })
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                                Товары не найдены.
                              </span>
                            )}
                            <div ref={complementaryLoadMoreRef} />
                            {isFetchingMoreComplementaryProducts ? (
                              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                                <Spinner />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </Accordion>
                    ) : null}
                  </div>
                </FormField>
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0 }}>Фотографии</h3>
                <FormField
                  label="Загрузить изображения"
                  description="Добавьте одно или несколько фото. Первое фото станет обложкой."
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImagesChange}
                    disabled={isSubmittingProduct}
                  />
                </FormField>
                {productImages.some((image) => !image.removed) ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: '16px',
                    }}
                  >
                    {productImages
                      .filter((image) => !image.removed)
                      .map((image) => (
                        <div
                          key={image.id}
                          style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                        >
                          <div
                            style={{
                              position: 'relative',
                              borderRadius: '12px',
                              overflow: 'hidden',
                              border: image.isPrimary
                                ? '2px solid var(--color-primary)'
                                : '1px solid var(--color-border)',
                              background: 'var(--color-surface-muted)',
                              aspectRatio: '1 / 1',
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={image.previewUrl}
                              alt={createForm.name ? `Фото ${createForm.name}` : 'Фото товара'}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            {image.isPrimary ? (
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: '8px',
                                  left: '8px',
                                  padding: '4px 8px',
                                  borderRadius: '999px',
                                  background: 'rgba(0, 0, 0, 0.6)',
                                  color: '#fff',
                                  fontSize: '0.75rem',
                                }}
                              >
                                Обложка
                              </span>
                            ) : null}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleSetPrimaryImage(image.id)}
                              disabled={image.isPrimary || isSubmittingProduct}
                            >
                              Сделать обложкой
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleRemoveImage(image.id)}
                              disabled={isSubmittingProduct}
                            >
                              Удалить
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    Фотографии пока не добавлены.
                  </span>
                )}
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0 }}>Габариты</h3>
                <Select
                  label="Форма"
                  value={createForm.dimensions.shape}
                  onChange={handleDimensionShapeChange}
                  error={createDimensionsShapeError}
                >
                  <option value="">Выберите форму</option>
                  {shapeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {createForm.dimensions.shape === 'circle__diameter' ? (
                    <Input
                      label="Диаметр, см"
                      type="text"
                      {...makeIntegerMask(createForm.dimensions.circle.diameter_cm, (next) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          dimensions: {
                            ...prev.dimensions,
                            circle: { diameter_cm: next },
                          },
                        }))
                      )}
                      error={createCircleDiameterError}
                    />
                  ) : null}
                  {createForm.dimensions.shape === 'line__length' ? (
                    <Input
                      label="Длина, см"
                      type="text"
                      {...makeIntegerMask(createForm.dimensions.line.length_cm, (next) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          dimensions: {
                            ...prev.dimensions,
                            line: { length_cm: next },
                          },
                        }))
                      )}
                      error={createLineLengthError}
                    />
                  ) : null}
                  {createForm.dimensions.shape === 'rectangle__length_width' ? (
                    <Input
                      label="Длина, см"
                      type="text"
                      {...makeIntegerMask(createForm.dimensions.rectangle.length_cm, (next) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          dimensions: {
                            ...prev.dimensions,
                            rectangle: {
                              ...prev.dimensions.rectangle,
                              length_cm: next,
                            },
                          },
                        }))
                      )}
                      error={createRectangleLengthError}
                    />
                  ) : null}
                  {createForm.dimensions.shape === 'rectangle__length_width' ? (
                    <Input
                      label="Ширина, см"
                      type="text"
                      {...makeIntegerMask(createForm.dimensions.rectangle.width_cm, (next) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          dimensions: {
                            ...prev.dimensions,
                            rectangle: {
                              ...prev.dimensions.rectangle,
                              width_cm: next,
                            },
                          },
                        }))
                      )}
                      error={createRectangleWidthError}
                    />
                  ) : null}
                  {createForm.dimensions.shape === 'cylinder__diameter_height' ? (
                    <Input
                      label="Диаметр, см"
                      type="text"
                      {...makeIntegerMask(createForm.dimensions.cylinder.diameter_cm, (next) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          dimensions: {
                            ...prev.dimensions,
                            cylinder: {
                              ...prev.dimensions.cylinder,
                              diameter_cm: next,
                            },
                          },
                        }))
                      )}
                      error={createCylinderDiameterError}
                    />
                  ) : null}
                  {createForm.dimensions.shape === 'cylinder__diameter_height' ? (
                    <Input
                      label="Высота, см"
                      type="text"
                      {...makeIntegerMask(createForm.dimensions.cylinder.height_cm, (next) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          dimensions: {
                            ...prev.dimensions,
                            cylinder: {
                              ...prev.dimensions.cylinder,
                              height_cm: next,
                            },
                          },
                        }))
                      )}
                      error={createCylinderHeightError}
                    />
                  ) : null}
                  {createForm.dimensions.shape === 'box__height_width_depth' ? (
                    <Input
                      label="Высота, см"
                      type="text"
                      {...makeIntegerMask(createForm.dimensions.box.height_cm, (next) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          dimensions: {
                            ...prev.dimensions,
                            box: {
                              ...prev.dimensions.box,
                              height_cm: next,
                            },
                          },
                        }))
                      )}
                      error={createBoxHeightError}
                    />
                  ) : null}
                  {createForm.dimensions.shape === 'box__height_width_depth' ? (
                    <Input
                      label="Ширина, см"
                      type="text"
                      {...makeIntegerMask(createForm.dimensions.box.width_cm, (next) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          dimensions: {
                            ...prev.dimensions,
                            box: {
                              ...prev.dimensions.box,
                              width_cm: next,
                            },
                          },
                        }))
                      )}
                      error={createBoxWidthError}
                    />
                  ) : null}
                  {createForm.dimensions.shape === 'box__height_width_depth' ? (
                    <Input
                      label="Глубина, см"
                      type="text"
                      {...makeIntegerMask(createForm.dimensions.box.depth_cm, (next) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          dimensions: {
                            ...prev.dimensions,
                            box: {
                              ...prev.dimensions.box,
                              depth_cm: next,
                            },
                          },
                        }))
                      )}
                      error={createBoxDepthError}
                    />
                  ) : null}
                </div>
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0 }}>Занятость</h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <Input
                    label="Чистка, дней"
                    type="text"
                    {...makeIntegerMask(createForm.occupancy.cleaning_days, (next) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        occupancy: { ...prev.occupancy, cleaning_days: next },
                      }))
                    )}
                    helperText="Необязательное поле."
                    error={createOccupancyCleaningError}
                  />
                  <Input
                    label="Страховой резерв, %"
                    type="text"
                    {...makeIntegerMask(createForm.occupancy.insurance_reserve_percent, (next) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        occupancy: {
                          ...prev.occupancy,
                          insurance_reserve_percent: next,
                        },
                      }))
                    )}
                    helperText="0–100%"
                    error={createOccupancyInsuranceError}
                  />
                </div>
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0 }}>Доставка</h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <Input
                    label="Объём, см³"
                    type="text"
                    {...makeDecimalMask(createForm.delivery.volume_cm3, (next) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        delivery: { ...prev.delivery, volume_cm3: next },
                      }))
                    )}
                    error={createDeliveryVolumeError}
                  />
                  <Input
                    label="Масса, кг"
                    type="text"
                    {...makeDecimalMask(createForm.delivery.weight_kg, (next) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        delivery: { ...prev.delivery, weight_kg: next },
                      }))
                    )}
                    error={createDeliveryWeightError}
                  />
                  <Select
                    label="Ограничение по транспорту"
                    value={createForm.delivery.transport_restriction}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        delivery: {
                          ...prev.delivery,
                          transport_restriction: event.target.value as TransportRestriction | '',
                        },
                      }))
                    }
                    error={createDeliveryTransportError}
                  >
                    <option value="">Выберите ограничение</option>
                    {transportRestrictionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}
                >
                  <input
                    type="checkbox"
                    checked={createForm.delivery.self_pickup_allowed}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        delivery: {
                          ...prev.delivery,
                          self_pickup_allowed: event.target.checked,
                        },
                      }))
                    }
                  />
                  Самовывоз разрешён
                </label>
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0 }}>Сетап</h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <Input
                    label="Монтаж, минут"
                    type="text"
                    {...makeIntegerMask(createForm.setup.install_minutes, (next) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        setup: { ...prev.setup, install_minutes: next },
                      }))
                    )}
                    error={createInstallMinutesError}
                  />
                  <Input
                    label="Демонтаж, минут"
                    type="text"
                    {...makeIntegerMask(createForm.setup.uninstall_minutes, (next) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        setup: { ...prev.setup, uninstall_minutes: next },
                      }))
                    )}
                    error={createUninstallMinutesError}
                  />
                  <Select
                    label="Квалификация сетапёров"
                    value={createForm.setup.installer_qualification}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        setup: {
                          ...prev.setup,
                          installer_qualification: event.target.value as
                            | InstallerQualification
                            | '',
                        },
                      }))
                    }
                    error={createInstallerQualificationError}
                  >
                    <option value="">Выберите квалификацию</option>
                    {installerQualificationOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="Требуемое число сетапёров"
                    value={createForm.setup.min_installers}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        setup: { ...prev.setup, min_installers: event.target.value },
                      }))
                    }
                    error={createMinInstallersError}
                  >
                    <option value="">Выберите значение</option>
                    {minInstallersOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </div>
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}
                >
                  <input
                    type="checkbox"
                    checked={createForm.setup.self_setup_allowed}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        setup: { ...prev.setup, self_setup_allowed: event.target.checked },
                      }))
                    }
                  />
                  Самостоятельный сетап разрешён
                </label>
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0 }}>Аренда</h3>
                <Select
                  label="Базовый период аренды"
                  value={createForm.rental.base_period}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      rental: { base_period: event.target.value as RentalBasePeriod | '' },
                    }))
                  }
                  error={createRentalBasePeriodError}
                >
                  <option value="">Выберите период</option>
                  {rentalBasePeriodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0 }}>Видимость</h3>
                <Select
                  label="Режим бронирования"
                  value={createForm.visibility.reservation_mode}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      visibility: {
                        ...prev.visibility,
                        reservation_mode: event.target.value as ReservationMode | '',
                      },
                    }))
                  }
                  error={createReservationModeError}
                >
                  <option value="">Выберите режим</option>
                  {reservationModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <div
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}
                >
                  <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={createForm.visibility.show_on_pifakit}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          visibility: { ...prev.visibility, show_on_pifakit: event.target.checked },
                        }))
                      }
                    />
                    Показывать на pifakit.ru
                  </label>
                  <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={createForm.visibility.show_on_site}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          visibility: { ...prev.visibility, show_on_site: event.target.checked },
                        }))
                      }
                    />
                    Показывать на сайте
                  </label>
                  <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={createForm.visibility.show_in_new}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          visibility: { ...prev.visibility, show_in_new: event.target.checked },
                        }))
                      }
                    />
                    Показывать в «Новинках»
                  </label>
                  <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={createForm.visibility.category_cover_on_home}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          visibility: {
                            ...prev.visibility,
                            category_cover_on_home: event.target.checked,
                          },
                        }))
                      }
                    />
                    Обложка категории на главной
                  </label>
                </div>
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0 }}>SEO</h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <Input
                    label="Slug"
                    placeholder="skaterth-amori-barkhatnaya"
                    value={createForm.seo.slug}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        seo: { ...prev.seo, slug: event.target.value },
                      }))
                    }
                  />
                  <Input
                    label="Meta title"
                    value={createForm.seo.meta_title}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        seo: { ...prev.seo, meta_title: event.target.value },
                      }))
                    }
                  />
                </div>
                <FormField label="Meta description">
                  <textarea
                    value={createForm.seo.meta_description}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        seo: { ...prev.seo, meta_description: event.target.value },
                      }))
                    }
                    rows={4}
                    placeholder="Описание для поисковых систем"
                    style={{
                      width: '100%',
                      borderRadius: '12px',
                      border: '1px solid var(--color-border)',
                      padding: '12px',
                      font: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                </FormField>
                <FormField label="Meta keywords" description="Введите ключевые слова для SEO.">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {createForm.seo.meta_keywords.map((keyword, index) => (
                      <div
                        key={`keyword-${index}`}
                        style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}
                      >
                        <Input
                          value={keyword}
                          placeholder="Ключевое слово"
                          onChange={(event) => handleMetaKeywordChange(index, event.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleRemoveMetaKeyword(index)}
                        >
                          Удалить
                        </Button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <Input
                        value={createForm.metaKeywordDraft}
                        onChange={handleMetaKeywordDraftChange}
                        placeholder="Новое ключевое слово"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleAddMetaKeyword}
                        disabled={!canAddMetaKeyword}
                      >
                        Добавить
                      </Button>
                    </div>
                  </div>
                </FormField>
              </section>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={closeProductModal}
              disabled={isSubmittingProduct}
            >
              Отмена
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmittingProduct || !isEditReady}>
              {isSubmittingProduct
                ? formMode === 'create'
                  ? 'Создаём…'
                  : 'Сохраняем…'
                : formMode === 'create'
                  ? 'Создать товар'
                  : 'Сохранить изменения'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={isDeleteModalOpen} title="Удаление товара" onClose={closeDeleteModal}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            Удалить товар «{productToDelete?.name ?? 'Без названия'}»? Это действие нельзя отменить.
          </p>
          {deleteProductMutation.isError ? (
            <Alert tone="danger" title="Не удалось удалить товар">
              {deleteProductErrorMessage}
            </Alert>
          ) : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={closeDeleteModal}
              disabled={isDeletingProduct}
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmDelete}
              disabled={isDeletingProduct}
            >
              {isDeletingProduct ? 'Удаляем…' : 'Удалить'}
            </Button>
          </div>
        </div>
      </Modal>
    </RoleGuard>
  );
}

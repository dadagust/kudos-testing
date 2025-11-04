import csv
import re
from decimal import Decimal
from pathlib import Path
from pprint import pprint
from typing import Any, Dict, List, Optional, Tuple
import requests

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Max
from django.utils.text import slugify as dj_slugify
import pandas as pd

from applications.products.models import (
    Category, Product, ProductImage, Color,
    TransportRestriction, InstallerQualification
)
from applications.products.choices import DimensionShape, RentalMode, ReservationMode

DIMENSION_SHAPE_SYNONYMS = {
    # internal value -> список подстрок/синонимов (lower)
    "circle__diameter": [
        "круг", "кругл", "диаметр", "d="
    ],
    "line__length": [
        "линия", "line"
    ],
    "rectangle__length_width": [
        "прямоуголь", "прямоуг", "rectangle"
    ],
    "cylinder__diameter_height": [
        "цилиндр"
    ],
    "box__height_width_depth": [
        "параллелепипед", "параллелеп", "box"
    ],
}

RESERVATION_MODE_SYNONYMS = {
    "operator_only": ["оператор", "через оператора", "менеджер", "вручную"],
    "online_allowed": ["онлайн", "online", "разрешено онлайн"],
    "disabled": ["запрещено", "disabled", "off", "закрыто"],
}

RENTAL_MODE_SYNONYMS = {
    "standard": ["стандарт", "стандартный", "обычный", "default", "base"],
    "special": ["особ", "special", "спец"],
}
# ---------- вспомогалки: парсеры/нормализация ----------

def resolve_choice_with_synonyms(
    raw: Optional[str],
    choices_list: Tuple[Tuple[str, str], ...],
    synonyms: Dict[str, List[str]]
) -> Optional[str]:
    """
    1) точное совпадение с internal value или label (без учёта регистра);
    2) если нет — матч по синонимам (подстроки, без учёта регистра).
    Возвращает internal value либо None.
    """
    if not raw:
        return None
    s = (raw or "").strip()
    s_norm = norm(s)

    # 1) прямое соответствие
    for internal, label in choices_list:
        if s_norm == norm(internal) or s_norm == norm(label):
            return internal

    # 2) по синонимам (подстрочная проверка)
    for internal, syn_list in synonyms.items():
        for syn in syn_list:
            if syn in s_norm:
                # убедимся, что internal реально есть в choices
                if any(internal == ci for ci, _ in choices_list):
                    return internal
    return None

def norm(s: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (s or "").strip()).lower()

def as_bool(v: Any) -> Optional[bool]:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v).strip().lower()
    if s in {"1", "true", "да", "истина", "y", "yes"}:
        return True
    if s in {"0", "false", "нет", "ложь", "n", "no"}:
        return False
    return None

def as_decimal(v: Any) -> Optional[Decimal]:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v).strip().replace(" ", "")
    s = s.replace(",", ".")
    try:
        return Decimal(s)
    except Exception:
        return None

def as_int(v: Any) -> Optional[int]:
    d = as_decimal(v)
    if d is None:
        return None
    try:
        return int(d)
    except Exception:
        return None

def first_present(df: pd.DataFrame, names: List[str]) -> Optional[str]:
    cols_norm = {norm(c): c for c in df.columns}
    for n in names:
        if norm(n) in cols_norm:
            return cols_norm[norm(n)]
    return None

def get_val(row: pd.Series, names: List[str]) -> Any:
    for n in names:
        if n in row:
            return row[n]
    return None


# --- В COLUMN_MAP добавь это и УДАЛИ перечисления circle_*/box_* и т.п. ---
COLUMN_MAP = {
    "name": ["Изделие"],
    "category": ["Категория", "Category"],
    "price_rub": ["Стоимость, руб."],
    "loss_compensation_rub": ["Компенсация", "Компенсация за потерю, руб", "Loss compensation"],
    "color": ["Цвет", "Color"],
    "features": ["Особенности", "Features"],
    "description": ["Описание", "Description"],
    "stock_qty": ["Запас, шт."],
    "delivery_volume_cm3": ["Объем, см³"],
    "delivery_weight_kg": ["Масса, кг"],
    "delivery_transport_restriction": ["Транспорт"],
    "delivery_self_pickup_allowed": ["Самовывоз разрешён", "Самовывоз", "Self pickup allowed"],
    "setup_install_minutes": ["Монтаж, мин"],
    "setup_uninstall_minutes": ["Демонтаж, мин"],
    "setup_installer_qualification": ["Квалификация сетапёров", "Квалификация монтажников", "Installer qualification"],
    "setup_min_installers": ["Минимум сетапёров", "Минимум монтажников"],
    "setup_self_setup_allowed": ["Самостоятельный сетап", "Self setup"],
    "rental_mode": ["Режим аренды", "Rental mode"],
    "rental_special_tiers": ["Тарифы аренды (особый)", "Special rental tiers", "Тарифы"],
    "visibility_reservation_mode": ["Бронирование", "Reservation mode"],
    "visibility_show_on_pifakit": ["На pifakit"],
    "visibility_show_on_site": ["На сайте", "Show on site"],
    "visibility_show_in_new": ["Новинки", "Show in new"],
    "visibility_category_cover_on_home": ["Обложка категории", "Category cover"],
    "occupancy_cleaning_days": ["Восстановление, дней"],

    # форма и единая колонка размеров
    "dimensions_shape": ["Форма", "Shape", "Форма габаритов"],
    "size": ["Размер"],

    # игнор
    "reserve_skip": ["Резерв", "Reserve"],
}

X_SEP = r"[x×\*\u0445]"  # латинская x, знак ×, *, русская х
NUM_RE = r"(?P<num>\d+(?:[.,]\d+)?)"
UNIT_RE = r"(?P<unit>см|cm|мм|mm)?"

DIAMETER_KEYS = [r"диаметр", r"\bø\b", r"[⌀øØ]", r"\bd\b"]
LENGTH_KEYS   = [r"длина", r"\bl\b", r"\bд\b"]
WIDTH_KEYS    = [r"ширина", r"\bw\b", r"\bш\b"]
HEIGHT_KEYS   = [r"высота", r"\bh\b", r"\bв\b"]
DEPTH_KEYS    = [r"глубина", r"\bdepth\b", r"\bг\b"]

def resolve_columns(df: pd.DataFrame) -> Dict[str, str]:
    resolved: Dict[str, str] = {}
    for key, cand in COLUMN_MAP.items():
        col = first_present(df, cand)
        if col:
            resolved[key] = col
    required = ["name", "category", "price_rub", "dimensions_shape", "size"]
    for r in required:
        if r not in resolved:
            raise CommandError(f"В Excel отсутствует обязательная колонка: {COLUMN_MAP[r]}")
    return resolved

def _to_cm(num_str: str, unit: Optional[str]) -> Decimal:
    d = Decimal(num_str.replace(",", "."))
    if unit and unit.lower() in {"мм", "mm"}:
        return d / Decimal("10")   # 10 мм = 1 см
    return d  # по умолчанию считаем см

def _find_labeled(s: str, keys: List[str]) -> Optional[Decimal]:
    for k in keys:
        # пример: "высота: 75 см" | "h=75" | "Ø 90" | "d90mm"
        m = re.search(fr"{k}\s*[:=]?\s*{NUM_RE}\s*{UNIT_RE}", s, flags=re.IGNORECASE)
        if m:
            return _to_cm(m.group("num"), m.group("unit"))
    return None

def _find_all_numbers(s: str) -> List[Decimal]:
    res: List[Decimal] = []
    for m in re.finditer(fr"{NUM_RE}\s*{UNIT_RE}", s, flags=re.IGNORECASE):
        res.append(_to_cm(m.group("num"), m.group("unit")))
    return res

def parse_size_by_shape(shape_val: str, raw: Any) -> Dict[str, Optional[Decimal]]:
    """
    На вход: internal value из DimensionShape (например, 'cylinder__diameter_height') и строка из колонки 'Размер'.
    Возвращает словарь со ВСЕМИ полями габаритов (остальные None).
    """
    s = str(raw or "").strip()
    s_norm = re.sub(r"\s+", " ", s.lower())

    out: Dict[str, Optional[Decimal]] = {
        "circle_diameter_cm": None,
        "line_length_cm": None,
        "rectangle_length_cm": None,
        "rectangle_width_cm": None,
        "cylinder_diameter_cm": None,
        "cylinder_height_cm": None,
        "box_height_cm": None,
        "box_width_cm": None,
        "box_depth_cm": None,
    }

    # Быстрые labeled-поиски (если есть слова, берём их в приоритете)
    labeled = {
        "diameter": _find_labeled(s_norm, DIAMETER_KEYS),
        "length":   _find_labeled(s_norm, LENGTH_KEYS),
        "width":    _find_labeled(s_norm, WIDTH_KEYS),
        "height":   _find_labeled(s_norm, HEIGHT_KEYS),
        "depth":    _find_labeled(s_norm, DEPTH_KEYS),
    }
    nums = _find_all_numbers(s_norm)  # все числа по порядку (в см)

    # Упростим доступ к числам:
    def nth(i: int) -> Optional[Decimal]:
        return nums[i] if i < len(nums) else None

    if shape_val == DimensionShape.CIRCLE_DIAMETER:
        d = labeled["diameter"] or nth(0)
        out["circle_diameter_cm"] = d
        return out

    if shape_val == DimensionShape.LINE_LENGTH:
        l = labeled["length"] or nth(0)
        out["line_length_cm"] = l
        return out

    if shape_val == DimensionShape.RECTANGLE_LENGTH_WIDTH:
        L = labeled["length"]
        W = labeled["width"]
        if L is None and W is None:
            # предположим формат "120x60" и аналоги
            # берём первые два числа по порядку: L, W
            L, W = nth(0), nth(1)
        out["rectangle_length_cm"] = L
        out["rectangle_width_cm"] = W
        return out

    if shape_val == DimensionShape.CYLINDER_DIAMETER_HEIGHT:
        d = labeled["diameter"]
        h = labeled["height"]
        if d is None and h is None:
            # Ø40×50, D=40 H=50, "40x50"
            d, h = nth(0), nth(1)
        out["cylinder_diameter_cm"] = d
        out["cylinder_height_cm"] = h
        return out

    if shape_val == DimensionShape.BOX_HEIGHT_WIDTH_DEPTH:
        H = labeled["height"]
        W = labeled["width"]
        D = labeled["depth"]
        if H is None or W is None or D is None:
            # пробуем угадать В×Ш×Г по порядку,
            # если встречаются три числа и нет всех ярлыков:
            if len(nums) >= 3:
                # если явно встречается последовательность 'в' 'ш' 'г' около разделителей — порядок по ВШГ
                # иначе — берём по умолчанию В, Ш, Г
                H = H or nth(0)
                W = W or nth(1)
                D = D or nth(2)
        out["box_height_cm"] = H
        out["box_width_cm"]  = W
        out["box_depth_cm"]  = D
        return out

    # На всякий случай возвращаем пустое — но до этого не должно доходить
    return out

# ---------- резолверы связанных сущностей ----------

def get_or_create_category(name: str) -> Category:
    o = Category.objects.filter(name__iexact=name).first()
    if o:
        return o
    return Category.objects.create(name=name, slug=dj_slugify(name, allow_unicode=True))

def get_or_create_color(value: str) -> Optional[Color]:
    if not value:
        return None
    o = Color.objects.filter(value__iexact=value).first()
    if o:
        return o
    # label = как есть, value — как в Excel (оригинал), не принуждаем к lower
    return Color.objects.create(value=value, label=value)

def get_or_create_transport(value: str) -> Optional[TransportRestriction]:
    if not value:
        return None
    o = TransportRestriction.objects.filter(value__iexact=value).first()
    if o:
        return o
    return TransportRestriction.objects.create(value=value, label=value)

def get_or_create_installer_qualification(name: str) -> Optional[InstallerQualification]:
    if not name:
        return None
    o = InstallerQualification.objects.filter(name__iexact=name).first()
    if o:
        return o
    return InstallerQualification.objects.create(name=name)


def resolve_choice(value: Optional[str], choices_list: Tuple[Tuple[str, str], ...]) -> Optional[str]:
    """
    Пытаемся сопоставить строку либо с internal value, либо с label (оба iexact).
    Возвращаем internal value либо None.
    """
    if not value:
        return None
    v = value.strip()
    v_norm = norm(v)
    for internal, label in choices_list:
        if v_norm == norm(internal) or v_norm == norm(label):
            return internal
    return None


# ---------- фото из манифеста ----------

def load_images_manifest(manifest_csv: Path) -> Dict[str, List[Dict[str, Any]]]:
    """
    Возвращает: { product_name_lower: [ {url, is_primary}, ... ] }
    """
    mapping: Dict[str, List[Dict[str, Any]]] = {}
    if not manifest_csv.exists():
        return mapping
    with open(manifest_csv, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = (row.get("product_name") or "").strip()
            url = (row.get("image_url") or "").strip()
            if not name or not url:
                continue
            key = norm(name)
            lst = mapping.setdefault(key, [])
            lst.append({
                "url": url,
                "is_primary": str(row.get("is_primary", "")).strip().lower() in {"true", "1", "yes"}
            })
    # первичное фото — первым
    for k, v in mapping.items():
        v.sort(key=lambda x: (not x["is_primary"],))  # primary -> first
    return mapping


def download_to_content(url: str, timeout: int = 25) -> Optional[ContentFile]:
    try:
        r = requests.get(url, timeout=timeout)
        if r.status_code != 200:
            return None
        return ContentFile(r.content)
    except Exception:
        return None


# ---------- команда ----------

class Command(BaseCommand):
    help = "Импорт товаров и изображений из Excel + images_manifest.csv"

    def add_arguments(self, parser):
        parser.add_argument("--excel", required=True, type=Path, help="Путь к Изделия.xlsx")
        parser.add_argument("--manifest", required=False, type=Path, default=None,
                            help="Путь к images_manifest.csv (из скраппера)")
        parser.add_argument("--sheet", required=False, default=0, help="Имя/индекс листа Excel")
        parser.add_argument("--dry-run", action="store_true", help="Не сохранять в БД, только валидировать")

    @transaction.atomic
    def handle(self, *args, **options):
        excel_path: Path = options["excel"]
        manifest_path: Optional[Path] = options.get("manifest")
        sheet = options["sheet"]
        dry_run = options["dry_run"]

        if not excel_path.exists():
            raise CommandError(f"Excel не найден: {excel_path}")

        df = pd.read_excel(excel_path, sheet_name=sheet)
        cols = resolve_columns(df)

        images_map = load_images_manifest(manifest_path) if manifest_path else {}

        created, updated, with_photos = 0, 0, 0
        problems: List[str] = []

        for _, src in df.iterrows():
            name = str(src[cols["name"]]).strip()
            if not name:
                continue

            # --- связки
            category_name = str(src[cols["category"]]).strip()
            category = get_or_create_category(category_name)

            color = None
            if "color" in cols and not pd.isna(src[cols["color"]]):
                color = get_or_create_color(str(src[cols["color"]]).strip())

            transport = None
            if "delivery_transport_restriction" in cols and not pd.isna(src[cols["delivery_transport_restriction"]]):
                transport = get_or_create_transport(str(src[cols["delivery_transport_restriction"]]).strip())

            inst_q = None
            if "setup_installer_qualification" in cols and not pd.isna(src[cols["setup_installer_qualification"]]):
                inst_q = get_or_create_installer_qualification(str(src[cols["setup_installer_qualification"]]).strip())

            dim_val = resolve_choice_with_synonyms(
                str(src[cols["dimensions_shape"]]) if not pd.isna(src[cols["dimensions_shape"]]) else "",
                tuple(DimensionShape.choices),
                DIMENSION_SHAPE_SYNONYMS
            )
            if not dim_val:
                problems.append(
                    f"[WARN] Не распознана Форма у '{name}': {src[cols['dimensions_shape']]} — товар будет пропущен")
                continue

            rental_mode = None
            if "rental_mode" in cols and not pd.isna(src[cols["rental_mode"]]):
                rental_mode = resolve_choice_with_synonyms(
                    str(src[cols["rental_mode"]]),
                    tuple(RentalMode.choices),
                    RENTAL_MODE_SYNONYMS
                ) or RentalMode.STANDARD

            reservation_mode = None
            if "visibility_reservation_mode" in cols and not pd.isna(src[cols["visibility_reservation_mode"]]):
                reservation_mode = resolve_choice_with_synonyms(
                    str(src[cols["visibility_reservation_mode"]]),
                    tuple(ReservationMode.choices),
                    RESERVATION_MODE_SYNONYMS
                ) or ""

            # --- числовые/булевые
            price = as_decimal(src[cols["price_rub"]])
            if price is None:
                problems.append(f"[WARN] Цена не число у '{name}', пропуск")
                continue

            loss_comp = as_decimal(src[cols["loss_compensation_rub"]]) if "loss_compensation_rub" in cols else None
            stock_qty = as_int(src[cols["stock_qty"]]) if "stock_qty" in cols else 0

            # --- габариты из одной колонки 'Размер' с учётом 'Форма'
            size_raw = str(src[cols["size"]]).strip() if "size" in cols and not pd.isna(src[cols["size"]]) else ""
            dims = parse_size_by_shape(dim_val, size_raw)
            occupancy_cleaning_days = (
                as_int(src[cols["occupancy_cleaning_days"]])
                if "occupancy_cleaning_days" in cols else None
            )
            # необязательно, но можно предупредить о странных значениях:
            if occupancy_cleaning_days is not None and occupancy_cleaning_days < 0:
                problems.append(f"[WARN] '{name}': Чистка, дни < 0 → пропуск значения")
                occupancy_cleaning_days = None
            # Валидация наличия нужных величин под выбранную форму
            def _need(*keys: str) -> bool:
                return all(dims[k] is not None for k in keys)

            if dim_val == DimensionShape.CIRCLE_DIAMETER and not _need("circle_diameter_cm"):
                problems.append(f"[WARN] '{name}': для формы Круг требуется Диаметр, но строка размера='{size_raw}'")
                continue

            if dim_val == DimensionShape.LINE_LENGTH and not _need("line_length_cm"):
                problems.append(f"[WARN] '{name}': для формы Линия требуется Длина, но строка размера='{size_raw}'")
                continue

            if dim_val == DimensionShape.RECTANGLE_LENGTH_WIDTH and not _need("rectangle_length_cm",
                                                                              "rectangle_width_cm"):
                problems.append(
                    f"[WARN] '{name}': для формы Прямоугольник нужны Длина×Ширина, но строка размера='{size_raw}'")
                continue

            if dim_val == DimensionShape.CYLINDER_DIAMETER_HEIGHT and not _need("cylinder_diameter_cm",
                                                                                "cylinder_height_cm"):
                problems.append(
                    f"[WARN] '{name}': для формы Цилиндр нужны Диаметр×Высота, но строка размера='{size_raw}'")
                continue

            if dim_val == DimensionShape.BOX_HEIGHT_WIDTH_DEPTH and not _need("box_height_cm", "box_width_cm",
                                                                              "box_depth_cm"):
                problems.append(
                    f"[WARN] '{name}': для формы Параллелепипед нужны В×Ш×Г, но строка размера='{size_raw}'")
                continue

            delivery_volume_cm3 = as_int(src[cols["delivery_volume_cm3"]]) if "delivery_volume_cm3" in cols else None
            delivery_weight_kg = as_decimal(src[cols["delivery_weight_kg"]]) if "delivery_weight_kg" in cols else None
            delivery_self_pickup_allowed = as_bool(src[cols["delivery_self_pickup_allowed"]]) if "delivery_self_pickup_allowed" in cols else None

            setup_install_minutes = as_int(src[cols["setup_install_minutes"]]) if "setup_install_minutes" in cols else None
            setup_uninstall_minutes = as_int(src[cols["setup_uninstall_minutes"]]) if "setup_uninstall_minutes" in cols else None
            setup_min_installers = as_int(src[cols["setup_min_installers"]]) if "setup_min_installers" in cols else None
            setup_self_setup_allowed = as_bool(src[cols["setup_self_setup_allowed"]]) if "setup_self_setup_allowed" in cols else None

            visibility_show_on_pifakit = as_bool(src[cols["visibility_show_on_pifakit"]]) if "visibility_show_on_pifakit" in cols else None
            visibility_show_on_site = as_bool(src[cols["visibility_show_on_site"]]) if "visibility_show_on_site" in cols else None
            visibility_show_in_new = as_bool(src[cols["visibility_show_in_new"]]) if "visibility_show_in_new" in cols else None
            visibility_category_cover_on_home = as_bool(src[cols["visibility_category_cover_on_home"]]) if "visibility_category_cover_on_home" in cols else None

            description = str(src[cols["description"]]).strip() if "description" in cols and not pd.isna(src[cols["description"]]) else ""
            features_raw = str(src[cols["features"]]).strip() if "features" in cols and not pd.isna(src[cols["features"]]) else ""
            features = [f.strip() for f in re.split(r"[;,]\s*", features_raw) if f.strip()] if features_raw else []

            # --- upsert продукта по name__iexact
            existing = Product.objects.filter(name__iexact=name).first()

            defaults = dict(
                features=features,
                category=category,
                price_rub=price,
                loss_compensation_rub=loss_comp,
                color=color,
                dimensions_shape=dim_val,

                circle_diameter_cm=dims["circle_diameter_cm"],
                line_length_cm=dims["line_length_cm"],
                rectangle_length_cm=dims["rectangle_length_cm"],
                rectangle_width_cm=dims["rectangle_width_cm"],
                cylinder_diameter_cm=dims["cylinder_diameter_cm"],
                cylinder_height_cm=dims["cylinder_height_cm"],
                box_height_cm=dims["box_height_cm"],
                box_width_cm=dims["box_width_cm"],
                box_depth_cm=dims["box_depth_cm"],

                occupancy_cleaning_days=occupancy_cleaning_days,
                description=description,
                stock_qty=stock_qty or 0,
                delivery_volume_cm3=delivery_volume_cm3,
                delivery_weight_kg=delivery_weight_kg,
                delivery_transport_restriction=transport,
                delivery_self_pickup_allowed=delivery_self_pickup_allowed or False,
                setup_install_minutes=setup_install_minutes,
                setup_uninstall_minutes=setup_uninstall_minutes,
                setup_installer_qualification=inst_q,
                setup_min_installers=setup_min_installers,
                setup_self_setup_allowed=setup_self_setup_allowed or False,
                rental_mode=rental_mode or RentalMode.STANDARD,
                rental_special_tiers=[],  # по желанию можно распарсить
                visibility_reservation_mode=reservation_mode or "",
                visibility_show_on_pifakit=visibility_show_on_pifakit or False,
                visibility_show_on_site=visibility_show_on_site or False,
                visibility_show_in_new=visibility_show_in_new or False,
                visibility_category_cover_on_home=visibility_category_cover_on_home or False,
                seo_meta_title="",
                seo_meta_description="",
            )
            if dry_run:
                self.stdout.write(self.style.WARNING(f"[DRY] {name} -> категория={category.name} цена={price}"))
                pprint(defaults)
                continue

            if existing:
                for k, v in defaults.items():
                    setattr(existing, k, v)
                existing.save()
                product = existing
                updated += 1
            else:
                product = Product.objects.create(name=name, **defaults)
                created += 1

            # --- изображения
            added_imgs = 0
            imgs = images_map.get(norm(name), [])
            if imgs:
                print(imgs)
                # очищать ли старые? оставим как есть; добавим недостающие в конец
                current_max_pos = product.images.aggregate(m=Max("position")).get("m") or 0
                next_pos = max(1, current_max_pos + 1)

                # если есть primary и position=1 свободна — вставим его на 1,
                # а существующие сместим; иначе — добавим начиная с next_pos
                if not product.images.filter(position=1).exists():
                    # первичное сейчас у нас первый в списке
                    primary_first = imgs[0]
                    if primary_first["is_primary"]:
                        cf = download_to_content(primary_first["url"])
                        if cf:
                            pi = ProductImage(product=product, position=1)
                            # имя файла примерно из URL
                            fname = Path(primary_first["url"]).name or f"{product.id}_01.jpg"
                            pi.file.save(fname, cf, save=True)
                            added_imgs += 1
                        # остаток
                        for idx, item in enumerate(imgs[1:], start=2):
                            cf = download_to_content(item["url"])
                            if not cf:
                                continue
                            pi = ProductImage(product=product, position=idx)
                            fname = Path(item["url"]).name or f"{product.id}_{idx:02d}.jpg"
                            pi.file.save(fname, cf, save=True)
                            added_imgs += 1
                    else:
                        # если первый не primary — добавим все по порядку с 1
                        for idx, item in enumerate(imgs, start=1):
                            cf = download_to_content(item["url"])
                            if not cf:
                                continue
                            pi = ProductImage(product=product, position=idx)
                            fname = Path(item["url"]).name or f"{product.id}_{idx:02d}.jpg"
                            pi.file.save(fname, cf, save=True)
                            added_imgs += 1
                else:
                    # у товара уже есть позиция 1 — просто докинем в конец
                    for item in imgs:
                        cf = download_to_content(item["url"])
                        if not cf:
                            continue
                        pi = ProductImage(product=product, position=next_pos)
                        fname = Path(item["url"]).name or f"{product.id}_{next_pos:02d}.jpg"
                        pi.file.save(fname, cf, save=True)
                        added_imgs += 1
                        next_pos += 1

            if added_imgs:
                with_photos += 1
        self.stdout.write(self.style.SUCCESS(
            f"Готово: создано {created}, обновлено {updated}, товаров с прикреплёнными фото: {with_photos}. "
            f"Замечания: {len(problems)}"
        ))
        print(problems)
        if dry_run:
            raise CommandError("[DRY] Откат транзакции — это была проверка без записи")

        self.stdout.write(self.style.SUCCESS(
            f"Готово: создано {created}, обновлено {updated}, товаров с прикреплёнными фото: {with_photos}. "
            f"Замечания: {len(problems)}"
        ))
        for p in problems[:50]:
            self.stdout.write(self.style.WARNING(p))
        if len(problems) > 50:
            self.stdout.write(self.style.WARNING(f"... ещё {len(problems) - 50} предупреждений"))

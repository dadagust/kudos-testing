
# Прайс‑лист — спецификация API `/products`

Документ для разработки модуля **«Прайс‑лист»** и доработки страницы **«Заказы»**.
Цель — реализовать полное CRUD‑API на эндпоинте `/products` и перевести загрузку товаров
на это API (вместо моков) с бесконечной прокруткой (infinite scroll).

> Все поля и выборы извлечены из предоставленных скриншотов интерфейса «Изделия».
Если какое‑то поле встречается в интерфейсе как выпадающий список, ниже задан явный
набор значений (enum). Единицы измерения указаны явно.

---

## 1) Термины и сущности

- **Product** — товар каталога/прайс‑листа.
- **Category** — иерархическая категория (дерево), например: «Скатерти круглые», «Посуда» и т. п.
- **Color** — справочник цветов, выбирается один цвет.
- **Image** — фотография товара (мультизагрузка, с управлением порядком).
- **Enums** — фиксированные наборы значений для выпадающих списков.

---

## 2) Перечисления (enums)

### 2.1 Цвет (Color)
Источник: выпадающий список «Цвет». Допустимые значения (одиночный выбор):
```json
{
  "color": [
    "white",
    "gray",
    "black",
    "red",
    "orange",
    "brown",
    "yellow",
    "green",
    "turquoise",
    "blue",
    "violet"
  ]
}
```
> Метки для UI (ru): Белый, Серый, Чёрный, Красный, Оранжевый, Коричневый, Жёлтый,
Зелёный, Бирюзовый, Синий, Фиолетовый.

### 2.2 Форма/тип габаритов (Dimensions.shape)
Источник: «Размеры → Форма», варианты из выпадающего списка.
```json
{
  "shape": [
    "circle__diameter",                  // Круг — диаметр
    "line__length",                      // Линия — длина
    "rectangle__length_width",           // Прямоугольник — длина и ширина
    "cylinder__diameter_height",         // Цилиндр — диаметр и высота
    "box__height_width_depth"            // Параллелепипед — высота, ширина и глубина
  ]
}
```

### 2.3 Транспортное ограничение (Delivery.transport_restriction)
Источник: «Для расчёта стоимости доставки → Транспорт».
```json
{
  "transport_restriction": [
    "any",               // Любой
    "truck_only",        // Только грузовой
    "heavy_only",        // Только большегрузный
    "heavy16_only",      // Только «Большегрузный 16+»
    "special2_only"      // Только «Особый 2»
  ]
}
```
> Конкретные наименования «heavy16_only», «special2_only» взяты со скриншотов и
должны совпадать с внутренними кодами в вашем справочнике транспорта.

### 2.4 Квалификация сетапёров (Setup.installer_qualification)
Источник: «Для расчёта стоимости сетапа → Квалификация сетапёров».
```json
{
  "installer_qualification": [
    "any",                         // Любой
    "worker_with_steam_generator"  // Только «Работник с парогенератором»
  ]
}
```

### 2.5 Требуемое число сетапёров (Setup.min_installers)
Источник: «Для расчёта стоимости сетапа → Число сетапёров».
```json
{
  "min_installers": [1, 2, 3, 4]   // «Достаточно одного», «Нужны двое», «Нужны трое», «Нужны четверо»
}
```

### 2.6 Режим бронирования (Visibility.reservation_mode)
Источник: «Другие настройки → Бронирование».
```json
{
  "reservation_mode": [
    "operator_only",   // Только через оператора
    "online_allowed",  // Разрешено онлайн
    "disabled"         // Запрещено
  ]
}
```
> По скриншоту видно «Только через оператора». Остальные коды приведены для полноты
работы UI и могут быть скрыты/отключены, если не используются.

### 2.7 Базовый период аренды (Rental.base_period)
Источник: «Для расчёта стоимости аренды → Базовый период аренды».
```json
{
  "base_period": [
    "standard"   // Стандартный
  ]
}
```
> При необходимости список можно расширить в справочнике без изменения контракта.

---

## 3) Модель данных `Product`

### 3.1 Поля товара

| Поле | Тип/единицы | Обязат. | Описание и правила |
|------|-------------|---------|--------------------|
| `id` | UUID/строка | да (сервер) | Идентификатор товара. |
| `name` | string | да | Название, например «Скатерть Амори бархатная молочная круглая». |
| `features` | string[] | нет | Список коротких особенностей: «Возможно увеличение количества по предзаказу», «Глажка только с изнаночной стороны» и т. п. |
| `category_id` | string/UUID | да | Ссылка на категорию (лист дерева), например «Скатерти круглые». |
| `price_rub` | number (>=0) | да | «Стоимость», рубли. |
| `loss_compensation_rub` | number (>=0) | нет | «Компенсация за потерю», рубли. |
| `color` | enum `Color` | нет | Одиночный выбор цвета. |
| `dimensions` | object | да | Габариты. Структура зависит от `dimensions.shape` (см. ниже). |
| `images` | Image[] | нет | Фотографии товара (мультизагрузка). |
| `occupancy` | object | нет | Блок «Для расчёта занятости». |
| `delivery` | object | нет | Блок «Для расчёта стоимости доставки». |
| `setup` | object | нет | Блок «Для расчёта стоимости сетапа». |
| `rental` | object | нет | Блок «Для расчёта стоимости аренды». |
| `visibility` | object | нет | Блок «Другие настройки». |
| `seo` | object | нет | Скрываемый блок «Настройки поисковой оптимизации». |
| `created_at` | datetime | да (сервер) | Дата создания. |
| `updated_at` | datetime | да (сервер) | Дата обновления. |

#### 3.1.1 `dimensions`

Общий вид:
```json
{
  "shape": "circle__diameter",
  "circle": { "diameter_cm": 330 }
}
```
Правила по `shape`:

- `circle__diameter` → требуются поля:
  - `circle.diameter_cm` (number, см, >0)

- `line__length` → требуются поля:
  - `line.length_cm` (number, см, >0)

- `rectangle__length_width` → требуются поля:
  - `rectangle.length_cm` (number, см, >0)
  - `rectangle.width_cm`  (number, см, >0)

- `cylinder__diameter_height` → требуются поля:
  - `cylinder.diameter_cm` (number, см, >0)
  - `cylinder.height_cm`   (number, см, >0)

- `box__height_width_depth` → требуются поля:
  - `box.height_cm` (number, см, >0)
  - `box.width_cm`  (number, см, >0)
  - `box.depth_cm`  (number, см, >0)

> Примечание: `delivery.volume_cm3` может вычисляться на сервере из габаритов, 
если не задан явно (см. ниже).

#### 3.1.2 `images`

```json
[
  {
    "id": "img_1",
    "url": "https://.../photo1.jpg",
    "position": 1
  }
]
```
Порядок задаётся полем `position` (целое ≥1).

#### 3.1.3 `occupancy` (Для расчёта занятости)

```json
{
  "cleaning_days": 1,               // «Чистка» — целые дни
  "insurance_reserve_percent": 0    // «Страховой резерв», 0..100
}
```

#### 3.1.4 `delivery` (Для расчёта стоимости доставки)

```json
{
  "volume_cm3": 3500,                  // Объём в см³
  "weight_kg": 2,                      // Масса в кг
  "transport_restriction": "any",      // enum Transport
  "self_pickup_allowed": true          // «Самовывоз»: Разрешен/Не разрешен
}
```
> `volume_cm3` может быть рассчитан сервером из `dimensions` при наличии формулы;
если не удаётся — поле обязательно на ввод.

#### 3.1.5 `setup` (Для расчёта стоимости сетапа)

```json
{
  "install_minutes": 20,                    // «Монтаж», минуты
  "uninstall_minutes": 10,                  // «Демонтаж», минуты
  "installer_qualification": "any",         // enum Setup.qualification
  "min_installers": 1,                      // 1..4
  "self_setup_allowed": true                // «Самостоятельный сетап»: Разрешен/Не разрешен
}
```

#### 3.1.6 `rental` (Для расчёта стоимости аренды)

```json
{
  "base_period": "standard"   // «Базовый период аренды»
}
```

#### 3.1.7 `visibility` (Другие настройки)

```json
{
  "reservation_mode": "operator_only",  // Бронирование
  "show_on_pifakit": true,              // «Показывать на pifakit.ru»
  "show_on_site": true,                 // «Показывать на сайте»
  "show_in_new": true,                  // «Показывать в „Новинках“»
  "category_cover_on_home": false       // «Обложка категории на главной»
}
```

#### 3.1.8 `seo` (Опционально, скрытый блок)

```json
{
  "slug": "skaterth-amori-barkhatnaya-molochnaya-kruglaya",
  "meta_title": "Скатерть Амори — молочная, круглая",
  "meta_description": "Качественная бархатная скатерть...",
  "meta_keywords": ["скатерть","амори","бархат"]
}
```

---

## 4) Категории

Категории — дерево. Для товара хранится `category_id` (лист либо узел по бизнес‑правилам).
Поддержать получения дерева целиком для селектора на фронте.

> Справочник редактируется отдельно (админское UI). В пределах этого ТЗ достаточно чтения.

---

## 5) Контракты API

Базовый URL: `/products`

### 5.1 Список товаров (для «Прайс‑листа» и «Заказы» с infinite scroll)

`GET /products`

**Параметры запроса (query):**
- `limit` — количество на страницу (по умолчанию 20, максимум 100).
- `cursor` — курсор для бесконечной прокрутки (строка, возвращается в ответе).
- `q` — текстовый поиск по названию/особенностям.
- `category_id` — фильтр по категории.
- `color` — фильтр по цвету (enum).
- `transport_restriction` — фильтр по транспорту (enum).
- `self_pickup` — `true|false`.
- `price_min`, `price_max` — фильтр по цене (руб).
- `ordering` — `-created_at`, `created_at`, `price_rub`, `-price_rub` (и т. п.).
- `include` — через запятую: `images,seo,dimensions` — чтобы не тащить лишнее на список по умолчанию.

**Ответ 200:**
```json
{
  "results": [
    {
      "id": "b9f3e7fe-...",
      "name": "Скатерть Амори бархатная молочная круглая",
      "price_rub": 2700,
      "color": "white",
      "category_id": "cat_round_tablecloths",
      "thumbnail_url": "https://.../photo1_360.jpg"
    }
  ],
  "next_cursor": "eyJwYWdlIjoyfQ=="   // null, если данных больше нет
}
```

> **Страница «Заказы»** должна использовать этот метод с `limit` и `cursor`
для бесконечной прокрутки. При первом запросе `cursor` опустить, на последующих
подставлять значение `next_cursor` из ответа. UI показывает элементы по мере подгрузки.

### 5.2 Создать товар

`POST /products` (JSON)

Пример тела (минимально достаточный + блоки из скриншотов):
```json
{
  "name": "Скатерть Амори бархатная молочная круглая",
  "features": [
    "Возможно увеличение количества по предзаказу.",
    "Глажка только с изнаночной стороны."
  ],
  "category_id": "cat_round_tablecloths",
  "price_rub": 2700,
  "loss_compensation_rub": 9000,
  "color": "white",
  "dimensions": {
    "shape": "circle__diameter",
    "circle": { "diameter_cm": 330 }
  },
  "occupancy": {
    "cleaning_days": 1,
    "insurance_reserve_percent": 0
  },
  "delivery": {
    "volume_cm3": 3500,
    "weight_kg": 2,
    "transport_restriction": "any",
    "self_pickup_allowed": true
  },
  "setup": {
    "install_minutes": 20,
    "uninstall_minutes": 10,
    "installer_qualification": "worker_with_steam_generator",
    "min_installers": 1,
    "self_setup_allowed": true
  },
  "rental": { "base_period": "standard" },
  "visibility": {
    "reservation_mode": "operator_only",
    "show_on_pifakit": true,
    "show_on_site": true,
    "show_in_new": true,
    "category_cover_on_home": false
  },
  "seo": {
    "slug": "skaterth-amori-barkhatnaya-molochnaya-kruglaya",
    "meta_title": "Скатерть Амори — молочная, круглая",
    "meta_description": "Качественная бархатная скатерть...",
    "meta_keywords": ["скатерть","амори","бархат"]
  }
}
```

**Ответ 201:**
```json
{
  "id": "b9f3e7fe-...",
  "created_at": "2025-10-26T17:00:00Z",
  "updated_at": "2025-10-26T17:00:00Z"
}
```

### 5.3 Получить товар

`GET /products/{id}?include=images,seo,dimensions`

Возвращает полную карточку товара. Поля — как в модели.

### 5.4 Обновить товар (частично)

`PATCH /products/{id}` — любой поднабор полей `Product`.

### 5.5 Удалить товар

`DELETE /products/{id}` → `204 No Content`.

### 5.6 Работа с изображениями

- `POST /products/{id}/images` — мультизагрузка (multipart/form-data):
  - поля: `files[]` (обяз.), опционально `positions[]` для порядка.
  - Ответ 201: массив добавленных `Image` с `id`, `url`, `position`.

- `PATCH /products/{id}/images/reorder` — JSON:
  ```json
  { "order": [{"id":"img_1","position":1},{"id":"img_2","position":2}] }
  ```

- `DELETE /products/{id}/images/{image_id}` → 204.

### 5.7 Справочники/подсказки для форм

- `GET /products/categories` — дерево категорий:
  ```json
  [{"id":"cat_root","name":"Мебель","children":[...]}]
  ```

- `GET /products/colors` — список enum `Color` с подписями/иконками.

- `GET /products/enums` — агрегированный ответ по перечислениям:
  ```json
  {
    "colors": [...],
    "shapes": [...],
    "transport_restrictions": [...],
    "installer_qualifications": [...],
    "reservation_modes": [...],
    "rental_base_periods": [...]
  }
  ```

---

## 6) Валидация и бизнес‑правила

1. **Габариты**: набор обязательных полей зависит от `dimensions.shape` (см. 3.1.1).
2. **Числовые поля**:
   - `price_rub`, `loss_compensation_rub` — `>= 0`.
   - `occupancy.insurance_reserve_percent` — `0..100`.
   - Время (`install_minutes`, `uninstall_minutes`) — целые `>= 0`.
   - `delivery.weight_kg`, `delivery.volume_cm3` — `> 0` (если не вычисляется).
3. **Сетап**:
   - `min_installers` ∈ {1,2,3,4}.
   - `installer_qualification` ∈ перечисления (см. 2.4).
   - `self_setup_allowed` — булево.
4. **Доставка**:
   - `transport_restriction` ∈ перечисления (см. 2.3).
   - `self_pickup_allowed` — булево.
5. **Видимость/бронь**:
   - `reservation_mode` ∈ перечисления (см. 2.6).
   - Прочие флаги — булевы.
6. **SEO**: `slug` — уникален в пределах каталога.

---

## 7) Изменения на странице «Заказы»

1. Перестать использовать мок‑товары. Вместо этого подгружать список из
`GET /products` с параметрами `limit` и `cursor` (см. 5.1).
2. На карточке списка для «Заказов» достаточно полей:
   - `id`, `name`, `price_rub`, `color`, `thumbnail_url`, `category_id`,
     `delivery.transport_restriction`, `delivery.self_pickup_allowed`.
3. По достижении конца списка — запрашивать следующую страницу с `cursor=next_cursor`.
4. Фильтры и поиск в «Заказах» (если нужны) подключить к одноимённым query‑параметрам
   метода `GET /products` (поиск `q`, фильтр `category_id`, `color` и т. п.).

---

## 8) Коды ошибок (общие)

- `400 Bad Request` — ошибка валидации; тело:
  ```json
  {"detail":"Validation error","errors":{"field":["message"]}}
  ```
- `404 Not Found` — товар/ресурс не найден.
- `409 Conflict` — дубликат `slug`.
- `413 Payload Too Large` — слишком большой файл изображения.
- `415 Unsupported Media Type` — неверный формат изображения.
- `422 Unprocessable Entity` — противоречивые поля (например, неверный набор габаритов для выбранной формы).

---

## 9) Замечания по реализации (Django/DRF)

- Рекомендуемая структура сериализатора: вложенные объекты `dimensions`, `occupancy`, `delivery`, `setup`, `rental`, `visibility`, `seo`.
- Для бесконечной прокрутки использовать **cursor pagination** DRF:
  - query: `limit`, `cursor`; ответ: `results`, `next_cursor`.
- Загрузка изображений — через отдельный action (`@action(detail=True, methods=['post'])`) с `multipart/form-data`.
- Автоподсчёт `delivery.volume_cm3` допустим, если форму можно однозначно вычислить из `dimensions`.
- Справочники (`/products/enums`, `/products/colors`, `/products/categories`) кешировать на фронте.

---

## 10) Пример полного объекта товара

```json
{
  "id": "b9f3e7fe-...",
  "name": "Скатерть Амори бархатная молочная круглая",
  "features": ["Возможно увеличение количества по предзаказу.","Глажка только с изнаночной стороны."],
  "category_id": "cat_round_tablecloths",
  "price_rub": 2700,
  "loss_compensation_rub": 9000,
  "color": "white",
  "dimensions": {
    "shape": "circle__diameter",
    "circle": { "diameter_cm": 330 }
  },
  "images": [
    {"id":"img_1","url":"https://.../1.jpg","position":1}
  ],
  "occupancy": {"cleaning_days":1,"insurance_reserve_percent":0},
  "delivery": {"volume_cm3":3500,"weight_kg":2,"transport_restriction":"any","self_pickup_allowed":true},
  "setup": {"install_minutes":20,"uninstall_minutes":10,"installer_qualification":"worker_with_steam_generator","min_installers":1,"self_setup_allowed":true},
  "rental": {"base_period":"standard"},
  "visibility": {"reservation_mode":"operator_only","show_on_pifakit":true,"show_on_site":true,"show_in_new":true,"category_cover_on_home":false},
  "seo": {"slug":"skaterth-amori-barkhatnaya-molochnaya-kruglaya","meta_title":"Скатерть Амори — молочная, круглая","meta_description":"Качественная бархатная скатерть...","meta_keywords":["скатерть","амори","бархат"]},
  "created_at": "2025-10-26T17:00:00Z",
  "updated_at": "2025-10-26T17:10:00Z"
}
```

---

## 11) Мини‑чеклист для фронтенда

- [ ] Список товаров в «Заказах» и «Прайс‑листе» берём из `GET /products` (cursor pagination).
- [ ] Карточка товара — `GET /products/{id}?include=images,seo,dimensions`.
- [ ] Создание/редактирование — `POST`/`PATCH /products`.
- [ ] Загрузка фото — `POST /products/{id}/images` + `PATCH /images/reorder`.
- [ ] Фильтры/поиск — query‑параметры списка.
- [ ] Справочники — разово тянем `/products/enums`, `/products/categories`, `/products/colors` и кешируем.

---

**Готово.** Это — самодостаточный контракт для реализации бэкенда `/products`
и перевода страницы «Заказы» на бесконечную прокрутку с реальными данными.

# Интеграция Яндекс Карт: адреса в заказах + страница «Логистика → Маршруты»

> Используем **Geosuggest API** (подсказки адресов), **Geocoder API** (нормализация и координаты) и **JavaScript API v3** (интерактивная карта).

---

## 0) Подготовка

- ключи от api яндекс карт лежат во всех .env.local
  `<script src="https://api-maps.yandex.ru/v3/?apikey=YOUR_KEY&lang=ru_RU"></script>` — вставляется на страницу перед инициализацией карты.

---

## 1) Бэкенд (Django): меняем модель `Order` и добавляем валидацию адреса

### 1.1 Модель

Заменяем простой `CharField` на структурированное хранение: сырой ввод, нормализованный адрес, координаты и метаданные качества (тип «kind», «precision»).

```python
# app/orders/models.py
from django.db import models

class Order(models.Model):
    # ... поля заказа ...

    delivery_address_input = models.CharField(
        verbose_name='Адрес доставки (ввод)',
        max_length=255, blank=True
    )
    delivery_address_full = models.CharField(
        verbose_name='Адрес доставки (нормализованный)',
        max_length=512, blank=True
    )
    delivery_lat = models.DecimalField(
        verbose_name='Широта', max_digits=9, decimal_places=6,
        null=True, blank=True
    )
    delivery_lon = models.DecimalField(
        verbose_name='Долгота', max_digits=9, decimal_places=6,
        null=True, blank=True
    )
    delivery_address_kind = models.CharField(
        verbose_name='Тип объекта (kind)', max_length=32, blank=True
    )
    delivery_address_precision = models.CharField(
        verbose_name='Точность (precision)', max_length=32, blank=True
    )
    yandex_uri = models.CharField(
        verbose_name='URI в Яндекс', max_length=255, blank=True
    )

    def has_exact_address(self) -> bool:
        return (self.delivery_address_kind == "house"
                and self.delivery_address_precision == "exact")
```

> В ответе Геокодера есть координаты **`Point.pos`** (строка `"lon lat"`), а также метаданные `GeocoderMetaData`, где содержатся поля **`kind`** (тип топонима: дом/улица/нас.пункт и т.д.) и **`precision`** (точность сопоставления). Порядок координат — «долгота, широта».


### 1.2 Сервис валидации/нормализации адреса

```python
# app/orders/services/yandex_maps.py
import os, requests
from typing import Optional, Dict

YANDEX_KEY = os.environ.get("YANDEX_MAPS_KEY")

def geocode_address(q: str, lang: str = "ru_RU") -> Optional[Dict]:
    """
    Возвращает:
    {
      "normalized": str, "lat": float, "lon": float,
      "kind": str, "precision": str, "uri": str
    } или None
    """
    url = "https://geocode-maps.yandex.ru/v1/"
    params = {"apikey": YANDEX_KEY, "geocode": q, "lang": lang, "format": "json"}
    r = requests.get(url, params=params, timeout=7)
    r.raise_for_status()
    data = r.json()

    coll = data.get("response", {}).get("GeoObjectCollection", {})
    items = coll.get("featureMember", [])
    if not items:
        return None

    obj = items[0]["GeoObject"]
    meta = obj["metaDataProperty"]["GeocoderMetaData"]
    pos = obj["Point"]["pos"].split()
    lon, lat = map(float, pos)  # порядок: lon, lat

    normalized = meta.get("Address", {}).get("formatted") or meta.get("text")
    return {
        "normalized": normalized,
        "lat": lat, "lon": lon,
        "kind": meta.get("kind", ""),
        "precision": meta.get("precision", ""),
        "uri": obj.get("uri", "")
    }
```

### 1.3 REST-эндпоинт: валидировать и сохранить адрес заказа

```python
# app/orders/api.py
from django.views.decorators.http import require_POST
from django.http import JsonResponse, HttpResponseBadRequest
from .models import Order
from .services.yandex_maps import geocode_address

@require_POST
def validate_and_set_address(request, order_id: int):
    q = request.POST.get("input") or ""
    if not q.strip():
        return HttpResponseBadRequest("Empty address")

    g = geocode_address(q)
    if not g:
        return JsonResponse({"ok": False, "reason": "not_found"}, status=404)

    order = Order.objects.get(pk=order_id)
    order.delivery_address_input = q
    order.delivery_address_full = g["normalized"]
    order.delivery_lat = g["lat"]
    order.delivery_lon = g["lon"]
    order.delivery_address_kind = g["kind"]
    order.delivery_address_precision = g["precision"]
    order.yandex_uri = g["uri"]
    order.save(update_fields=[
        "delivery_address_input","delivery_address_full",
        "delivery_lat","delivery_lon",
        "delivery_address_kind","delivery_address_precision","yandex_uri"
    ])
    return JsonResponse({"ok": True, "exists": order.has_exact_address(), **g})
```

### 1.4 REST-эндпоинт: список заказов для карты (логистика)

```python
# app/orders/api.py
from django.views.decorators.http import require_GET
from django.http import JsonResponse
from .models import Order

@require_GET
def orders_with_coords(request):
    qs = (Order.objects
          .exclude(delivery_lat__isnull=True)
          .exclude(delivery_lon__isnull=True))
    items = [{
        "id": o.id,
        "address": o.delivery_address_full or o.delivery_address_input,
        "lat": float(o.delivery_lat),
        "lon": float(o.delivery_lon),
        "exact": o.has_exact_address(),
    } for o in qs]
    return JsonResponse({"items": items})
```

---

## 2) Страница **orders**: ввод адреса через Яндекс (подсказки + валидация)

**Подход:** на клиенте — подсказки от **Geosuggest API**; после выбора — обязательный вызов **Geocoder API** для нормализации и координат; затем сохраняем в заказ.

Реализуем на странцие orders в React приложении staff. 


## 3) Frontend (React, приложение **staff**): «Логистика → Маршруты»

### 3.1 Роут/меню

Добавить подпункт «Маршруты» в раздел **Логистика** и роут `/staff/logistics/routes`.


### 3.2 Компонент страницы

- Слева — список заказов (запрос `GET /api/orders-with-coords`).  
- Справа — интерактивная карта JS API v3: `YMap` + слои, для каждой точки — `YMapMarker` с DOM-элементом; при большом числе точек используйте кластеризацию из примеров.

---

## 4) UX-правила и валидация на сервере

- На сервере всегда «добиваем» подсказку через **Geocoder API** и сохраняем нормализованный адрес + координаты; сами подсказки (Suggest) в БД не храним.  
- «Адрес существует (точно)» — используем правило: `kind == "house"` и `precision == "exact"` как сильный сигнал (иначе помечаем как приблизительный и подсвечиваем в UI).  
- На фронте `lang=ru_RU`; при локальных проектах ограничивайте окно поиска `bbox` (или `ll`/`spn`).

---

## 6) Чек-лист задач

1. **Миграция Django**  
   — Добавить поля модели `Order` (см. §1.1).  
   — (Опционально) перенести `delivery_address` → `delivery_address_input`.

2. **Сервис Яндекс Геокодера**  
   — `orders/services/yandex_maps.py::geocode_address` (см. §1.2).  
   — Настройка `YANDEX_MAPS_KEY` в окружении.

3. **REST API**  
   — `POST /api/orders/{id}/validate-address` — валидация и сохранение адреса (см. §1.3).  
   — `GET /api/orders-with-coords` — список заказов для карты (см. §1.4).

4. **Страница orders**  
   — Виджет ввода адреса с **Geosuggest** + до-запрос **Geocoder** (см. §2).

5. **Frontend (staff)**  
   — Роут «Логистика → Маршруты».  
   — Компонент `LogisticsRoutesPage`: инициализация карты **JS API v3**, маркеры **YMapMarker**, подгонка границ (см. §3).

6. **Документация/ключи**  
   — Добавить `.env`/секреты и `YANDEX_MAPS_KEY` для фронта.  
   — Ограничить ключи в кабинете (Referrer/IP).

---

### Примечания «на потом» (не делать сейчас)

- Кластеризация, готовые UI-компоненты (`@yandex/ymaps3-default-ui-theme`).  
- Расчёт маршрутов/дистанций и ETA для доставки: **Distance Matrix API** (массовые A→B) и **Router API** (шаги, полилинии маршрута).

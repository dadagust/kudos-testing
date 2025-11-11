# KUDOS — Накладная заказа (PDF через WeasyPrint)

## Цель
Добавить генерацию **PDF‑накладной по заказу** с пиксель‑перфект макетом “как на скриншоте”. Кнопка печати доступна в списках заказов на страницах:
- `/logistics/prep` — подготовка заказов;
- `/logistics/receiving` — прием возвратов.

При клике на иконку система формирует и отдает PDF. Документ открывается в новой вкладке (или скачивается, в зависимости от браузера).

---

## Пользовательский сценарий
1. Пользователь (логист, кладовщик, менеджер) видит у строки заказа иконку 🖨️.
2. Кликает по иконке:
   - на `/logistics/prep` формируется “**Накладная на выдачу**”;
   - на `/logistics/receiving` — “**Накладная на возврат**”.
3. PDF открывается в новой вкладке. Можно распечатать/сохранить.

---

## Контракты URL и параметры
- `GET /logistics/orders/<order_id>/waybill.pdf?context=prep|receiving`
  - `context=prep` — накладная на выдачу (колонка **“Количество получаемого”** заполнена; остальные — пустые).
  - `context=receiving` — накладная на возврат (колонка **“Количество возвращаемого”** заполняется фактом приема; если факта нет — пусто).
  - Заголовок: `Content-Type: application/pdf`
  - Ответ: потоковый PDF (inline; через `Content-Disposition: inline; filename="waybill-<order_id>.pdf"`).

Права доступа: только аутентифицированные сотрудники с правом на просмотр заказа и документов логистики (роль/permission в соответствии с текущей RBAC). При отсутствии прав — 403.

---

## Источники данных (маппинг полей)
Документ **должен быть визуально идентичен** макету на скриншоте. Ниже — соответствие полей.

Левая шапка:
- Логотип **KUDOS** (статик `kudos.jpg`).
- Заголовок: `Заказ #{{ order.id }}`.
- **Адрес доставки:** `order.delivery_address` (или “Самовывоз”, если `order.delivery_type == PICKUP`).
- **Монтаж:** дата монтажа и интервал: `order.mount_datetime_from` — `order.mount_datetime_to`.
- **Демонтаж:** дата демонтажа и интервал: `order.dismount_datetime_from` — `order.dismount_datetime_to`.
- **Информация об оплате:** `“оплачен” | “не оплачен”` из платежного статуса заказа.

Правая шапка:
- Блок арендодателя (строгий текст из настроек):
  - `settings.WAYBILL_LANDLORD_NAME` (если не найдено то, “ИП Климовицкий Алексей Михайлович”)
  - `settings.WAYBILL_LANDLORD_ADDR` (если не найдено то, 105187 , г Москва, г. Москва, Верхнисажная ул., 6)
- Чек‑лист с пустыми чекбоксами и полями под числа/отметки (визуально как на макете, значения не заполняются):
  - Сетка
  - Угол
  - Ящики для приборов
  - Ящики для посуды
  - Ящики для стекла
  - Залог
  - Транспортировочные чехлы

Таблица спецификации (строго как в макете):
- Колонки (фикcированные заголовки):
  1. `#`
  2. `Наименование`
  3. `Место`
  4. `Количество получаемого`
  5. `Количество возвращаемого`
  6. `Утеря / бой / повреждение`
  7. `Примечание`

- Наполнение:
  - `#` — порядковый номер строки.
  - `Наименование` — `item.title` (вариант: `product.name + variant`).
  - **prep**: `Количество получаемого = item.qty_planned`.
  - **receiving**: `Количество возвращаемого = item.qty_returned` (или пусто).
  - Остальные колонки — пустые (заполняются вручную на бумаге).

Блоки подписей(внизу):
- **Выдача заказа**
  - Слева — “Заказ выдал, количество и состояние проверил от Арендодателя: __________________ / __________________”
  - Справа — “Заказ принял, количество и состояние проверил от Арендатора: __________________ / __________________”
- **Возврат заказа**
  - Слева — “Заказ принял, количество и состояние проверил от Арендодателя: __________________ / __________________”
  - Справа — “Заказ передал, количество и состояние проверил от Арендатора: __________________ / __________________”
- Строки “Примечание:” под каждым блоком — пустые.

> ⚠️ Визуальное совпадение: отступы, размеры шрифтов, толщина линий, размеры чекбоксов, тени и т.д. должны соответствовать скриншоту.

---

## Макет PDF (страница и типографика)
- Формат: **A4, альбомная (landscape)**.
- Поля: **10 мм** по всем сторонам.
- Базовый шрифт: `Inter`, `DejaVu Sans` (fallback), `sans-serif`.
- Размеры шрифта:
  - Заголовок “Заказ #…” — `18–20px` жирный.
  - Подписи шапки и таблица — `11–12px`.
- Линии таблиц: 1px, серый `#d5d7db`.
- Чекбоксы: квадрат **14×14px**, рамка `#aeb1b7`, без заливки.
- Таблица:
  - Заголовки в `thead` с фиксированным фоном `#f0f1f3` и тонкой внутренней тенью.
  - `thead { display: table-header-group; }` чтобы шапка повторялась на новых страницах.
  - Разрешить автоматические переносы строк в ячейках наименований.
- Логотип KUDOS — слева сверху, высота ~**36px**.
- Блок арендодателя — справа выровнен по верхнему краю.

---

## Архитектура и файлы
- Шаблон: `templates/pdf/waybill.html`
- Стили: `static/pdf/waybill.css`
- Представление (Django): `apps/logistics/views/waybill.py` → `OrderWaybillPdfView`
- URL: `apps/logistics/urls.py`

---

## Реализация (Django + WeasyPrint)

### 1) Настройки
`settings.py`:
```python
WAYBILL_LANDLORD_NAME = "ИП Климовицкий Алексей Михайлович"
WAYBILL_LANDLORD_ADDR = "105187, г. Москва, г. Москва, Вернисажная ул., 6"
WAYBILL_LOGO_PATH = "img/kudos-logo.svg"   # внутри STATICFILES_DIRS
WAYBILL_DEFAULT_FONT = "DejaVu Sans"
```

### 2) URL
```python
# apps/logistics/urls.py
from django.urls import path
from .views.waybill import OrderWaybillPdfView

urlpatterns = [
    path("orders/<int:pk>/waybill.pdf", OrderWaybillPdfView.as_view(), name="order_waybill_pdf"),
]
```

### 3) View
```python
# apps/logistics/views/waybill.py
from django.conf import settings
from django.http import HttpResponse, Http404
from django.template.loader import render_to_string
from django.views import View
from weasyprint import HTML, CSS
from urllib.parse import unquote
from apps.orders.models import Order
from django.contrib.auth.mixins import LoginRequiredMixin
from apps.common.permissions import StaffPermissionRequired  # пример

class OrderWaybillPdfView(LoginRequiredMixin, StaffPermissionRequired, View):
    # permission_required = "orders.view_order"  # пример
    def get(self, request, pk):
        context = request.GET.get("context", "prep")
        if context not in {"prep", "receiving"}:
            context = "prep"

        try:
            order = (
                Order.objects
                .select_related("manager")
                .prefetch_related("items", "items__product")
                .get(pk=pk)
            )
        except Order.DoesNotExist:
            raise Http404

        # Приведение доменных данных к нужным полям шаблона
        landlord = {
            "name": settings.WAYBILL_LANDLORD_NAME,
            "addr": settings.WAYBILL_LANDLORD_ADDR,
        }

        template_ctx = {
            "order": order,
            "landlord": landlord,
            "context_kind": context,
            "logo_static": settings.WAYBILL_LOGO_PATH,
        }

        html = render_to_string("pdf/waybill.html", template_ctx)
        css = CSS(filename=settings.STATIC_ROOT / "pdf" / "waybill.css")  # либо url=...
        pdf = HTML(string=html, base_url=request.build_absolute_uri("/")).write_pdf(stylesheets=[css])

        resp = HttpResponse(pdf, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="waybill-{order.pk}.pdf"'
        return resp
```

### 5) Шаблон (фрагмент)
> **Важно:** размеры, отступы, тени и цвета подогнаны под скриншот. Используйте `mm` для стабильности.

```html
<!-- templates/pdf/waybill.html -->
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>Накладная — Заказ #{{ order.number|default:order.id }}</title>
<link rel="stylesheet" href="{{ STATIC_URL }}pdf/waybill.css">
</head>
<body class="page">
  <header class="header">
    <div class="logo-title">
      <img src="{{ STATIC_URL }}{{ logo_static }}" class="logo" alt="KUDOS">
      <h1>Заказ #{{ order.number|default:order.id }}</h1>
    </div>

    <div class="grid-header">
      <section class="left">
        <dl class="meta">
          <div><dt>Адрес доставки:</dt><dd>{% if order.is_self_pickup %}Самовывоз{% else %}{{ order.delivery_address }}{% endif %}</dd></div>
          <div><dt>Монтаж:</dt><dd>{{ order.mount_datetime_from|date:"j E Y, H:i" }} — {{ order.mount_datetime_to|date:"H:i" }}</dd></div>
          <div><dt>Демонтаж:</dt><dd>{{ order.dismount_datetime_from|date:"j E Y, H:i" }} — {{ order.dismount_datetime_to|date:"H:i" }}</dd></div>
          <div><dt>Контактное лицо на монтаже:</dt><dd>{{ order.mount_contact_name }}, {{ order.mount_contact_phone }}</dd></div>
          <div><dt>Контактное лицо на демонтаже:</dt><dd>{{ order.dismount_contact_name }}, {{ order.dismount_contact_phone }}</dd></div>
          <div><dt>Менеджер заказа:</dt><dd>{{ order.manager.get_full_name }}</dd></div>
          <div><dt>Комментарий к заказу:</dt><dd>{{ order.comment|default:"нет" }}</dd></div>
          <div><dt>Информация об оплате:</dt><dd>{% if order.is_paid %}оплачен{% else %}не оплачен{% endif %}</dd></div>
        </dl>
      </section>

      <section class="right landlord">
        <p class="landlord-title">Арендодатель:</p>
        <p>{{ landlord.name }}<br>{{ landlord.addr }}</p>
        <ul class="checks">
          <li><span class="cb"></span> Сетка ______</li>
          <li><span class="cb"></span> Угол ______</li>
          <li><span class="cb"></span> Ящики для приборов ______</li>
          <li><span class="cb"></span> Ящики для посуды ______</li>
          <li><span class="cb"></span> Ящики для стекла ______</li>
          <li><span class="cb"></span> Залог ______</li>
          <li><span class="cb"></span> Транспортировочные чехлы ______</li>
        </ul>
      </section>
    </div>
  </header>

  <main>
    <table class="spec">
      <thead>
        <tr>
          <th>#</th>
          <th>Наименование</th>
          <th>Место</th>
          <th>Количество получаемого</th>
          <th>Количество возвращаемого</th>
          <th>Утеря / бой / повреждение</th>
          <th>Примечание</th>
        </tr>
      </thead>
      <tbody>
        {% for item in order.items.all %}
        <tr>
          <td>{{ forloop.counter }}</td>
          <td>{{ item.title }}</td>
          <td>
            {% if item.place_icon %}<img class="place-ico" src="{{ item.place_icon_url }}">{% endif %}
            {{ item.locations_display }}
          </td>
          <td>{% if context_kind == "prep" %}{{ item.qty_planned }}{% endif %}</td>
          <td>{% if context_kind == "receiving" %}{{ item.qty_returned }}{% endif %}</td>
          <td></td>
          <td></td>
        </tr>
        {% endfor %}
      </tbody>
    </table>

    <section class="sign-block">
      <h3>Выдача заказа</h3>
      <div class="sign-row">
        <div>Заказ выдал, количество и состояние проверил от Арендодателя: <span class="line"></span> / <span class="line"></span></div>
        <div>Заказ принял, количество и состояние проверил от Арендатора: <span class="line"></span> / <span class="line"></span></div>
      </div>
      <div class="note">Примечание: <span class="line wide"></span></div>
    </section>

    <section class="sign-block">
      <h3>Возврат заказа</h3>
      <div class="sign-row">
        <div>Заказ принял, количество и состояние проверил от Арендодателя: <span class="line"></span> / <span class="line"></span></div>
        <div>Заказ передал, количество и состояние проверил от Арендатора: <span class="line"></span> / <span class="line"></span></div>
      </div>
      <div class="note">Примечание: <span class="line wide"></span></div>
    </section>
  </main>
</body>
</html>
```

### 6) CSS (фрагмент — ключевые моменты совпадения с макетом)
```css
/* static/pdf/waybill.css */
@page { size: A4 landscape; margin: 10mm; }

body.page { font-family: "Inter", "DejaVu Sans", sans-serif; font-size: 11.5px; color: #111827; }

.header .logo { height: 36px; }
.header .logo-title { display: flex; align-items: center; gap: 12mm; margin-bottom: 6mm; }
.header h1 { font-size: 20px; font-weight: 700; margin: 0; }

.grid-header { display: grid; grid-template-columns: 1fr 0.9fr; gap: 10mm; }

.meta dt { width: 48mm; float: left; color: #4b5563; }
.meta dd { margin-left: 50mm; margin-bottom: 1.2mm; }

.landlord-title { font-weight: 700; margin: 0 0 1mm; }
.checks { list-style: none; padding: 0; margin: 3mm 0 0; }
.checks li { display: flex; align-items: center; gap: 2mm; margin-bottom: 2mm; }
.cb { display: inline-block; width: 14px; height: 14px; border: 1px solid #aeb1b7; }

table.spec { width: 100%; border-collapse: collapse; margin-top: 6mm; }
table.spec thead th {
  background: #f0f1f3; border: 1px solid #d5d7db; padding: 2mm; font-weight: 600;
  box-shadow: inset 0 1px 0 rgba(0,0,0,.05);
}
table.spec td { border: 1px solid #d5d7db; padding: 2mm; vertical-align: top; }
thead { display: table-header-group; }

.place-ico { width: 10mm; height: auto; margin-right: 2mm; }

.sign-block { margin-top: 6mm; }
.sign-block h3 { font-size: 12.5px; margin: 0 0 2mm; }
.sign-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin-bottom: 2mm; }
.line { display: inline-block; border-bottom: 1px solid #9ca3af; width: 35mm; height: 4mm; }
.line.wide { width: 100%; height: 6mm; }
.note { margin-top: 2mm; }
```

---

## Встраивание иконки печати на страницах
В таблицах заказов `/logistics/prep` и `/logistics/receiving` для каждой строки:
```html
<a class="btn-print" href="{% url 'order_waybill_pdf' order.id %}?context=prep" target="_blank" title="Печать">
  <!-- SVG-иконка принтера -->
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">…</svg>
</a>
```
Для страницы возврата замените `context=receiving`.

Минимальные стили:
```css
.btn-print { display: inline-flex; align-items: center; padding: 4px; border-radius: 6px; }
.btn-print:hover { background: #f3f4f6; }
```

## Готовность/критерии приемки
- Иконка печати на обоих списках присутствует, открывает верный тип накладной.
- Макет PDF визуально соответствует скриншоту (отступы, шрифты, цвета, сетка, чекбоксы).
- Все поля корректно подставляются из данных заказа.
- Повтор шапки таблицы при переносе на следующую страницу — работает.
- Генерация доступна только уполномоченным пользователям.

---

## Замечания по пиксель‑перфект
- Если наблюдается «толще/тоньше» линии — регулируйте `border-color` и `rgba`‑тени.
- Для полного совпадения шрифта используйте **Inter** из статики (`static/fonts/Inter/…`) и объявите `@font-face` в CSS.
- Чекбоксы и подписи — именно фиксированных размеров. Не заменять нативными input, рисовать CSS‑рамками.


## План внедрения
1. Поставить системные библиотеки и `weasyprint` в образ.
2. Добавить шаблон, CSS и view.
3. Прописать URL и права.
4. Подключить иконки на страницах `/logistics/prep` и `/logistics/receiving`.

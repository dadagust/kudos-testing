# Задача: сверстать хедер + hero-блок лендинга KUDOS

## Контекст

Проект: фронтенд футер сервиса аренды мебели и декора KUDOS.  
Стек: Next.js 14, React, TypeScript, CSS Modules (.module.sass).  
Нужно сверстать футер строго по дизайну из Figma.

## Дизайн

- Figma (desktop 1400): `https://www.figma.com/design/dEU66gzw6eBDF4fVgAcDvt/Kudos--Design-?node-id=4214-4455&t=pd0iv0HLxXa7lV7T-4`
- Экспорт дизайна: `docs/design/kudos-landing-catalogue-desktop.png` (точный скрин фрейма)

- Figma (mobile 350): `https://www.figma.com/design/dEU66gzw6eBDF4fVgAcDvt/Kudos--Design-?node-id=4214-5130&t=pd0iv0HLxXa7lV7T-4`
- Экспорт дизайна: `docs/design/kudos-landing-catalogue-mobile.png` (точный скрин фрейма)

Шрифты:
- Основной: `Jost`

## Файлы

Создать/обновить:

- `Компонент Списка Каталога`
- `Стили для Списка Каталога`

## Требования к вёрстке

1**Пиксель-перфект**
   - Все размеры, отступы и выравнивания взять из Figma, ориентируемся на экран 1400 для desktop и 350 для mobile
   - Ширина контейнера, межколоночные расстояния и высота хедера должны совпадать с фреймом 1400 в Figma.



## Получение Каталога

Создать на backend эндпоинт для получения всего Каталога. Делать мы это будем при помощи модели Category.

В ней хранится вся нужная информация. А именно фото и название. Их мы получаем и отображаем. 

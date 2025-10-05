# Kudos Admin Aggregator

Монорепозиторий с бэкендом (Django) и двумя фронтенд-приложениями на Next.js.

## Старт окружения

### Backend
1. Перейдите в папку `backend`.
2. Установите зависимости: `poetry install`.
3. Выполните миграции: `poetry run python manage.py migrate`.
4. Запустите сервер: `poetry run python manage.py runserver 0.0.0.0:8000`.

### Storefront (`frontend`)
1. Перейдите в папку `frontend`.
2. Установите зависимости: `pnpm install`.
3. Запустите dev-сервер: `pnpm dev` (порт `3001`).

### Staff portal (`staff`)
1. Перейдите в папку `staff`.
2. Установите зависимости: `pnpm install`.
3. Подготовьте git-хуки: `pnpm prepare`.
4. Запустите dev-сервер: `pnpm dev` (порт `3000`).

## Проверки качества

- Storefront lint: `pnpm --dir frontend lint`.
- Staff lint: `pnpm --dir staff lint`.
- Stylelint для staff: `pnpm --dir staff lint:styles`.
- TypeScript проверка (staff): `pnpm --dir staff typecheck`.
- Backend тесты: `poetry run python manage.py test`.

## Husky + lint-staged + commitlint

После `pnpm install` выполните `pnpm prepare`, чтобы установить git-хуки в `staff`. При коммите будет запускаться `lint-staged`, а сообщение проверяется `commitlint` (правила Conventional Commits).

## Настройка переменных окружения

- `backend/config/.env.local` — переменные Django.
- `frontend` и `staff` используют `NEXT_PUBLIC_API_URL` (по умолчанию `http://localhost:8000/api`).

## Полезные команды

- Создание суперпользователя: `poetry run python manage.py createsuperuser`
- Сброс базы данных: удалить `backend/db.sqlite3` и заново выполнить миграции

# Kudos Admin Aggregator

Монорепозиторий с витриной магазина (Next.js 14 + TypeScript), кабинетом менеджера (Next.js 14 +
TypeScript + SASS) и backend-gateway (Django + DRF).

## Старт окружения

### Backend

1. Установите зависимости в корне репозитория: `poetry install`.
2. Установите переменную окружения для подключения к локальной SQLite базе данных:
   `export DATABASE_URL=sqlite:///db.sqlite3` (по умолчанию используется PostgreSQL и
   потребуется `psycopg2`).
3. Выполните миграции: `poetry run python manage.py migrate`.
4. Загрузите тестовые данные: `poetry run python manage.py seed_demo_data`.
5. Запустите сервер: `poetry run python manage.py runserver 0.0.0.0:8000`.

Тестовые пользователи создаются автоматически (пароль по умолчанию `ChangeMe123!`).

### Frontend (витрина)

1. Перейдите в папку `frontend`.
2. Установите зависимости: `pnpm install`.
3. Запустите dev-сервер: `pnpm dev` (порт `3000`).

### Staff (ЛК менеджера)

1. Перейдите в папку `staff`.
2. Установите зависимости: `pnpm install`.
3. Подготовьте git-хуки: `pnpm run prepare`.
4. Запустите dev-сервер: `pnpm dev` (порт `3100`).

## Проверки качества

- Линтинг витрины: `pnpm lint` (из директории `frontend`).
- Линтинг кабинета менеджера: `pnpm lint` (из директории `staff`).
- Stylelint для кабинета: `pnpm run lint:styles`.
- TypeScript проверка: `pnpm typecheck` (в нужной директории).
- Backend тесты: `poetry run python manage.py test` (из корня репозитория). Для запуска
  без PostgreSQL предварительно задайте `DATABASE_URL=sqlite:///db.sqlite3`.

## Husky + lint-staged + commitlint

После `pnpm install` выполните `pnpm run prepare`, чтобы установить git-хуки в `staff`. При коммите будет запускаться `lint-staged`, а сообщение проверяется `commitlint` (правила Conventional Commits).

## Настройка переменных окружения

- `.env` — можно задать `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CORS_ORIGINS`.
- Витрина (`frontend`) использует `NEXT_PUBLIC_API_URL` (по умолчанию `http://localhost:8000/core`).
- Кабинет менеджера (`staff`) использует `NEXT_PUBLIC_API_URL` (по умолчанию `http://localhost:8000/core`).

## Полезные команды

- Генерация фикстур: `poetry run python manage.py seed_demo_data --password MySecurePass1!`
- Сброс базы данных: удалить `db.sqlite3` и заново выполнить миграции/seed.

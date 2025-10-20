# Kudos Admin Aggregator

Монорепозиторий с витриной магазина (Next.js 14 + TypeScript), кабинетом менеджера (Next.js 14 +
TypeScript + SASS) и backend-gateway (Django + DRF).

## Гайд по запуску

### Локальная разработка

#### Backend (Django + DRF)

1. Перейдите в каталог `backend`.
2. Установите зависимости: `make install` (использует Poetry).
3. При необходимости задайте переменные окружения в `backend/config/.env.local`
   или экспортируйте `DATABASE_URL=sqlite:///db.sqlite3` для SQLite.
4. Выполните миграции: `make migrate`.
5. Загрузите тестовые данные: `make seed`.
6. Запустите сервер разработки: `make run` (порт `8000`).

Тестовые пользователи создаются автоматически (пароль по умолчанию `ChangeMe123!`).

#### Frontend (витрина)

1. Перейдите в каталог `frontend`.
2. Установите зависимости: `make install` (по умолчанию `pnpm install`).
3. Запустите dev-сервер: `make dev` (порт `4000`).

#### Staff (кабинет менеджера)

1. Перейдите в каталог `staff`.
2. Установите зависимости: `make install`.
3. Подготовьте git-хуки (опционально): `make prepare`.
4. Запустите dev-сервер: `make dev` (порт `3000`).

### Docker-окружение

В корне репозитория находится Makefile для сборки контейнеров:

- `make backend-image` — собирает образ `kudos-backend`.
- `make frontend-image` — собирает образ `kudos-frontend`.
- `make staff-image` — собирает образ `kudos-staff`.
- `make images` — собирает все образы сразу.

Примеры запуска контейнеров после сборки:

- Backend: `docker run --rm -p 8000:8000 --env-file backend/config/.env.local kudos-backend`.
- Frontend: `docker run --rm -p 4000:4000 kudos-frontend`.
- Staff: `docker run --rm -p 3000:3000 kudos-staff`.

Не забудьте прокинуть переменные окружения (например, `NEXT_PUBLIC_API_URL`) через `--env` или `--env-file`.

## Проверки качества

- Линтинг витрины: `make lint` (каталог `frontend`).
- TypeScript проверка витрины: `make typecheck` (каталог `frontend`).
- Линтинг кабинета менеджера: `make lint` (каталог `staff`).
- Stylelint для кабинета: `make lint-styles` (каталог `staff`).
- TypeScript для кабинета: `make typecheck` (каталог `staff`).
- Backend тесты: `make test` (каталог `backend`). Для запуска без PostgreSQL задайте
  `DATABASE_URL=sqlite:///db.sqlite3`.

## Husky + lint-staged + commitlint

После `pnpm install` выполните `pnpm run prepare` (или `make prepare`), чтобы установить git-хуки в `staff`. При коммите будет запускаться `lint-staged`, а сообщение проверяется `commitlint` (правила Conventional Commits).

## Настройка переменных окружения

- `backend/config/.env.local` — можно задать `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CORS_ORIGINS`.
- Витрина (`frontend`) использует `NEXT_PUBLIC_API_URL` (по умолчанию `http://localhost:8000/core`).
- Кабинет менеджера (`staff`) использует `NEXT_PUBLIC_API_URL` (по умолчанию `http://localhost:8000/core`).

## Полезные команды

- Генерация фикстур: `make seed` (каталог `backend`). Для нестандартного пароля используйте
  `poetry run python manage.py seed_demo_data --password MySecurePass1!`.
- Сброс базы данных: удалить `db.sqlite3` и заново выполнить `make migrate && make seed`.

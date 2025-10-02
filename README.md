# Kudos Admin Aggregator

Монорепозиторий с фронтендом (Next.js 14 + TypeScript + SASS) и backend-gateway (Django + DRF).

## Старт окружения

### Backend
1. Перейдите в папку `backend-gateway`.
2. Установите зависимости: `poetry install`.
3. Выполните миграции: `poetry run python manage.py migrate`.
4. Загрузите тестовые данные: `poetry run python manage.py seed_demo_data`.
5. Запустите сервер: `poetry run python manage.py runserver 0.0.0.0:8000`.

Тестовые пользователи создаются автоматически (пароль по умолчанию `ChangeMe123!`).

### Frontend
1. Перейдите в папку `frontend`.
2. Установите зависимости: `npm install`.
3. Подготовьте git-хуки: `npm run prepare`.
4. Запустите dev-сервер: `npm run dev` (порт `3000`).

## Проверки качества

- Линтинг фронтенда: `npm run lint` (из директории `frontend`).
- Stylelint отдельно: `npm run lint:styles`.
- TypeScript проверка: `npm run typecheck`.
- Backend тесты: `poetry run python manage.py test`.

## Husky + lint-staged + commitlint

После `npm install` выполните `npm run prepare`, чтобы установить git-хуки. При коммите будет запускаться `lint-staged`, а сообщение проверяется `commitlint` (правила Conventional Commits).

## Настройка переменных окружения

- `backend-gateway/.env` — можно задать `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CORS_ORIGINS`.
- `frontend` использует `NEXT_PUBLIC_API_URL` (по умолчанию `http://localhost:8000/api`).

## CI

В репозитории настроен GitHub Actions workflow (`.github/workflows/ci.yml`) для линтинга и тестов фронтенда/бэкенда при PR.

## Полезные команды

- Генерация фикстур: `poetry run python manage.py seed_demo_data --password MySecurePass1!`
- Создание суперпользователя: `poetry run python manage.py createsuperuser`
- Сброс базы данных: удалить `backend-gateway/db.sqlite3` и заново выполнить миграции/seed.

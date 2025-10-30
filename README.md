# Kudos Testing Monorepo

Короткий гид по запуску всех частей проекта.

## 1. Предварительные требования
- Docker и Docker Compose
- Node.js 20+ и [pnpm](https://pnpm.io) (для локального запуска фронтендов)
- Python 3.12 и [Poetry](https://python-poetry.org) (для локального запуска бэкенда)

## 2. Клонирование репозитория
```bash
git clone https://gitlab.com/ilstudio/kudos
cd kudos
```

## 3. Запуск через Docker Compose (рекомендуемый)
Перед запуском можно скопировать файл `.env.example` в `.env` и при необходимости переопределить порты публикации сервисов:

```bash
cp .env.example .env
docker compose up --build
```
Команда собирает образы, поднимает Postgres, Redis, Django-бэкенд (`:8000` по умолчанию), пользовательский фронтенд (`:4000`) и административный фронтенд (`:3000`). Значения можно изменить через переменные `BACKEND_PORT`, `FRONTEND_PORT` и `STAFF_PORT` в файле `.env`.

### Запуск на портах 9000 / 5000 / 4000
1. Скопируйте пример окружения и укажите желаемые порты публикации сервисов:
   ```bash
   cp .env.example .env
   ```
   ```env
   BACKEND_PORT=9000
   FRONTEND_PORT=5000
   STAFF_PORT=4000
   ```
2. Обновите разрешённые источники для CORS в `backend/config/.env.local`, добавив фронтенды с новыми портами:
   ```env
   DJANGO_CORS_ORIGINS=http://localhost:4000,http://127.0.0.1:4000,http://localhost:5000,http://127.0.0.1:5000
   ```
3. Убедитесь, что фронтенды обращаются к бэкенду на новом порту:
   ```env
   # frontend/.env.local
   KUDOS_BACKEND_ORIGIN=http://localhost:9000
   NEXT_PUBLIC_API_URL=http://localhost:9000
   ```
   ```env
   # staff/.env.local
   NEXT_PUBLIC_API_URL=http://localhost:9000
   ```
4. Запустите сервисы:
   ```bash
   docker compose up --build
   ```
После запуска Django будет доступен на `http://localhost:9000`, пользовательский фронтенд — на `http://localhost:5000`, а административный — на `http://localhost:4000`.

Остановка сервисов:
```bash
docker compose down
```

## 4. Локальный запуск бэкенда
1. Установить зависимости:
   ```bash
   cd backend
   poetry install
   ```
2. Настроить переменные окружения (пример):
   ```bash
   export DATABASE_URL=postgresql://kudos:kudos@localhost:5432/kudos
   export REDIS_URL=redis://localhost:6379/0
   export DJANGO_SETTINGS_MODULE=settings.settings
   export DJANGO_DEBUG=1
   ```
3. Применить миграции и запустить сервер:
   ```bash
   poetry run python manage.py migrate
   poetry run python manage.py runserver 0.0.0.0:8000
   ```

> Поднять локально Postgres и Redis можно отдельными контейнерами или командой `docker compose up postgres redis` из корня репозитория.

## 5. Локальный запуск фронтендов
Перед стартом убедитесь, что переменная `NEXT_PUBLIC_API_URL` указывает на работающий бэкенд (по умолчанию `http://localhost:8000`).

### Пользовательский фронтенд (`frontend/`)
```bash
cd frontend
pnpm install
pnpm dev
```
Приложение будет доступно на `http://localhost:4000`.

### Административный фронтенд (`staff/`)
```bash
cd staff
pnpm install
pnpm dev
```
Приложение будет доступно на `http://localhost:3000`.

## 6. Полезные make-команды
```bash
make up        # docker compose up -d
make down      # docker compose down
make up-build  # docker compose up --build -d
```

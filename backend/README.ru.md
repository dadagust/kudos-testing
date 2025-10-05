# Бэкенд Kudos

Бэкенд-сервис платформы Kudos на базе шаблона IL Studio, адаптированного под отдельный API.

## Стек

- **Python 3.12** и [Poetry](https://python-poetry.org/) для управления зависимостями
- **Django 5.2.7** со структурой настроек на базе split-settings
- **Ruff** и **pytest** для статического анализа и автотестов

## Быстрый старт

```bash
poetry install
poetry run python manage.py migrate
poetry run python manage.py runserver 0.0.0.0:8000
```

Переменные окружения читаются из `config/.env.local`, если файл существует. Начните с копирования примера:

```bash
cp config/.env.local.example config/.env.local
```

## Структура проекта

```
applications/   приложения Django (core, main)
config/         файлы конфигурации окружения
logs/           журналы работы
settings/       настройки Django
static/         собранные статические файлы (генерируются)
templates/      шаблоны Django
```

## Полезные команды

- `make deps` — установка зависимостей Python через Poetry
- `poetry run python manage.py createsuperuser` — создание администратора
- `poetry run pytest` — запуск тестов

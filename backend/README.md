# Kudos Backend

Backend service for the Kudos platform, based on the IL Studio Django template and adapted for a standalone API.

## Stack

- **Python 3.12** managed through [Poetry](https://python-poetry.org/)
- **Django 5.2.7** with the split settings pattern
- **Ruff** and **pytest** for static analysis and automated tests

## Getting started

```bash
poetry install
poetry run python manage.py migrate
poetry run python manage.py runserver 0.0.0.0:8000
```

Environment variables are loaded from `config/.env.local` if the file is present. Copy the example file to get started:

```bash
cp config/.env.local.example config/.env.local
```

## Project structure

```
applications/   Django apps (core, main)
config/         environment configuration helpers
logs/           runtime logs
settings/       Django project settings
static/         compiled static assets (generated)
templates/      Django templates
```

## Useful commands

- `make deps` – install Python dependencies with Poetry
- `poetry run python manage.py createsuperuser` – create an administrative account
- `poetry run pytest` – run the automated test suite

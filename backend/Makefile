POETRY ?= poetry
PYTHON ?= python
MANAGE := $(PYTHON) manage.py

.PHONY: install run migrate makemigrations shell superuser lint format check test seed

install:
	$(POETRY) install

run:
	$(POETRY) run $(MANAGE) runserver 0.0.0.0:8000

migrate:
	$(POETRY) run $(MANAGE) migrate

makemigrations:
	$(POETRY) run $(MANAGE) makemigrations

shell:
	$(POETRY) run $(MANAGE) shell

superuser:
	$(POETRY) run $(MANAGE) createsuperuser

seed:
	$(POETRY) run $(MANAGE) seed_demo_data

lint:
	$(POETRY) run ruff check applications settings

format:
	$(POETRY) run ruff format applications settings

check: lint test

test:
	$(POETRY) run $(MANAGE) test

lint:
	ruff check applications

# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential libpq-dev postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml backend/poetry.lock ./
RUN pip install --no-cache-dir "poetry==1.8.3" \
    && poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi

COPY backend/ ./
COPY backend/entrypoint.sh ./entrypoint.sh
# если на Windows редактировал файл, убери CRLF:
# RUN sed -i 's/\r$//' ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]

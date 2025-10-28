#!/usr/bin/env bash
set -euo pipefail

# --- ждём БД (pg_isready удобнее всего) ---
: "${DB_HOST:=localhost}"
: "${DB_PORT:=5432}"

echo "Waiting for Postgres at $DB_HOST:$DB_PORT ..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -q; do
  sleep 1
done
echo "Postgres is ready."

python manage.py migrate --noinput

python manage.py seed_categories || true
python manage.py seed_demo_data || true

exec python manage.py runserver 0.0.0.0:8000

#!/usr/bin/env bash
set -euo pipefail

: "${DB_HOST:=postgres}"
: "${DB_PORT:=5432}"
: "${DB_USER:=kudos}"
: "${DB_NAME:=kudos}"

echo "Waiting for Postgres at $DB_HOST:$DB_PORT ..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q; do
    sleep 1
done
echo "Postgres is ready."

python manage.py migrate --noinput
python manage.py collectstatic --noinput

python manage.py seed_categories || true
python manage.py seed_installer_qualifications || true
python manage.py seed_product_enums || true
python manage.py seed_demo_data || true

BACKEND_PORT="${BACKEND_PORT:-8000}"
echo "Starting Gunicorn on 0.0.0.0:${BACKEND_PORT}"

exec gunicorn settings.wsgi:application \
    --bind "0.0.0.0:${BACKEND_PORT}" \
    --workers 4 \
    --threads 2 \
    --timeout 120

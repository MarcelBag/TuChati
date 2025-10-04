
#!/usr/bin/env sh
set -e

echo "🔍 Checking database connectivity with psycopg2..."
until pg_isready -h "${POSTGRES_HOST:-db}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-tuchati}" >/dev/null 2>&1; do
  echo "⏳ Waiting for database at ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}…"
  sleep 2
done
echo "✅ Database is up — proceeding"

python manage.py migrate --noinput
python manage.py collectstatic --noinput

# Compile translations if present
if [ -d /app/locale ]; then
  echo "[i18n] Compiling message catalogs..."
  python -m django compilemessages -f || true
fi

echo "🚀 Starting Gunicorn (ASGI via Daphne)"
exec daphne -b 0.0.0.0 -p 8000 tuchati_config.asgi:application

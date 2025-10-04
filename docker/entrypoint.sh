#!/usr/bin/env sh
set -e

# If arguments were passed, just exec them (e.g. manage.py commands)
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-tuchati_config.settings}"
export PYTHONPATH="${PYTHONPATH:-/app/backend}"

# Always compile .mo (works in dev w/ bind-mount and in prod)
if [ -d /app/locale ]; then
  echo "[i18n] Compiling message catalogs..."
  python -m django compilemessages -f || true
fi

# Wait for Postgres
until pg_isready -h "${POSTGRES_HOST:-db}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-tuchati}" >/dev/null 2>&1; do
  echo "⏳ Waiting for database at ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}…"
  sleep 2
done
echo "Database is up — running migrations"

python manage.py migrate --noinput
python manage.py collectstatic --noinput

# Create superuser if env vars present
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
python - <<'PY'
import os, django
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
u = os.environ["DJANGO_SUPERUSER_USERNAME"]
e = os.environ.get("DJANGO_SUPERUSER_EMAIL", "")
p = os.environ["DJANGO_SUPERUSER_PASSWORD"]
if not User.objects.filter(username=u).exists():
    User.objects.create_superuser(u, e, p)
    print(f"🆕 Created superuser {u}")
else:
    print(f"ℹ️  Superuser {u} already exists")
PY
fi

echo "🌍 Starting Daphne ASGI server..."
exec daphne -b 0.0.0.0 -p 8000 tuchati_config.asgi:application

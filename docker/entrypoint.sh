#!/usr/bin/env sh
set -e

# Export Django settings module early
export DJANGO_SETTINGS_MODULE=tuchati_config.settings

# 🔍 DB connectivity check (now with pg_isready)
echo "🔍 Checking database connectivity..."
until pg_isready -h "${POSTGRES_HOST:-db}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-tuchati}" >/dev/null 2>&1; do
  echo "⏳ Waiting for database at ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}…"
  sleep 2
done
echo "✅ Database is up proceeding"

# Django commands (manage.py auto-uses DJANGO_SETTINGS_MODULE)
cd /app/backend  # Ensure in project root
python manage.py migrate --noinput
python manage.py collectstatic --noinput

# Compile translations if present (use manage.py to load settings)
if [ -d /app/locale ] && [ "$(ls -A /app/locale)" ]; then  # Check non-empty
  echo "[i18n] Compiling message catalogs..."
  python manage.py compilemessages -f || true
else
  echo "[i18n] Skipping: locale empty"
fi

# Optional superuser creation
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
u = '${DJANGO_SUPERUSER_USERNAME}'
e = '${DJANGO_SUPERUSER_EMAIL:-}'
p = '${DJANGO_SUPERUSER_PASSWORD}'
if not User.objects.filter(username=u).exists():
    User.objects.create_superuser(u, e, p)
    print(f'🆕 Created superuser {u}')
else:
    print(f'ℹ️ Superuser {u} already exists')
"
fi

echo "🚀 Starting Daphne ASGI server"
exec daphne -b 0.0.0.0 -p 8000 tuchati_config.asgi:application
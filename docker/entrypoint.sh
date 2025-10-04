#!/usr/bin/env sh
set -e

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-tuchati_config.settings}"
export PYTHONPATH="${PYTHONPATH:-/app/backend}"

if [ -d /app/locale ]; then
  echo "[i18n] Compiling message catalogs..."
  python -m django compilemessages -f || true
fi

echo "🔍 Checking database connectivity with psycopg2..."
python - <<'PY'
import os, time, sys
import psycopg2
host = os.getenv("POSTGRES_HOST", "tuchati_db")
port = int(os.getenv("POSTGRES_PORT", "5432"))
user = os.getenv("POSTGRES_USER", "tuchati")
password = os.getenv("POSTGRES_PASSWORD", "tuchati")
dbname = os.getenv("POSTGRES_DB", "tuchati")

for i in range(60):
    try:
        conn = psycopg2.connect(host=host, port=port, user=user, password=password, dbname=dbname)
        conn.close()
        print("✅ Database is up — proceeding")
        sys.exit(0)
    except Exception as e:
        print(f"⏳ Waiting for database at {host}:{port}… ({i+1}/60)")
        time.sleep(2)
print("❌ Could not connect to the database in time"); sys.exit(1)
PY

python manage.py migrate --noinput
python manage.py collectstatic --noinput

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

echo "🚀 Starting Daphne ASGI server..."
exec daphne -b 0.0.0.0 -p 8000 tuchati_config.asgi:application

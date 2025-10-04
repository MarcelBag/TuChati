#!/usr/bin/env bash
set -e
python backend/manage.py migrate --noinput
exec daphne -b 0.0.0.0 -p 8000 tuchati_config.asgi:application

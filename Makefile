SHELL := /bin/bash
DC := docker compose -f docker/docker-compose.yml -p tuchati

up:
	$(DC) up -d --build
down:
	$(DC) down
logs:
	$(DC) logs -f ongea_backend
migrate:
	$(DC) exec ongea_backend python backend/manage.py migrate
createsuperuser:
	$(DC) exec ongea_backend python backend/manage.py createsuperuser
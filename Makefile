# ---- config ----
SHELL := /bin/bash
DOCKER_DIR := docker
SERVICE    ?= ongea_backend

DC := cd $(DOCKER_DIR) && docker compose
EX := $(DC) exec -T $(SERVICE) bash -lc

.PHONY: dev prod down logs shell migrate createsuperuser makemigrations

# ----------------------------
# Environments
# ----------------------------
dev:
	cd $(DOCKER_DIR) && docker compose -f docker-compose.yml -f compose.dev.yml down
	cd $(DOCKER_DIR) && ln -sf ../.env.dev .env && docker compose -f docker-compose.yml -f compose.dev.yml up -d --build

prod:
	cd $(DOCKER_DIR) && docker compose -f docker-compose.yml down
	cd $(DOCKER_DIR) && ln -sf ../.env.prod .env && docker compose -f docker-compose.yml up -d --build

# ----------------------------
# Management helpers
# ----------------------------
down:
	cd $(DOCKER_DIR) && docker compose down

logs:
	cd $(DOCKER_DIR) && docker compose logs -f $(SERVICE)

shell:
	$(EX) "bash"

migrate:
	$(EX) "python manage.py migrate"

makemigrations:
	$(EX) "python manage.py makemigrations"

createsuperuser:
	$(EX) "python manage.py createsuperuser"

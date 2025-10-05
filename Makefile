# makefile
# ============================================
# TuChati Makefile — Docker Helper Commands
# Simplifies local (dev) and production (prod) management
# ============================================

# Use bash shell for consistency
SHELL := /bin/bash

# Directory containing Docker files
DOCKER_DIR := docker

# Default service name (used in commands like `make logs`, `make shell`, etc.)
SERVICE ?= web

# Shortcuts to make Docker Compose calls cleaner
DC := cd $(DOCKER_DIR) && docker compose
EX := $(DC) exec -T $(SERVICE) bash -lc

# Declare non-file targets
.PHONY: dev prod down logs shell migrate createsuperuser makemigrations

# --------------------------------------------
# DEV — Run local development environment
# Uses compose.yml + compose.dev.yml
# --------------------------------------------
dev:
	cd docker && ln -sf ../.env.dev .env && \
	docker compose -f compose.yml -f compose.dev.yml up -d --build


# --------------------------------------------
# PROD — Run production stack
# Uses only compose.yml + .env.prod
# --------------------------------------------
prod:
	cd $(DOCKER_DIR) && docker compose -f compose.yml down
	cd $(DOCKER_DIR) && ln -sf ../.env.prod .env && docker compose -f compose.yml up -d --build

# --------------------------------------------
# 🧹 DOWN — Stop and remove all containers, networks, etc.
# --------------------------------------------
down:
	cd $(DOCKER_DIR) && docker compose down

# --------------------------------------------
# 🪵 LOGS — Follow logs from the web container (by default)
# Change SERVICE=nginx to see Nginx logs, etc.
# Example: make logs SERVICE=nginx
# --------------------------------------------
logs:
	cd $(DOCKER_DIR) && docker compose logs -f $(SERVICE)

# --------------------------------------------
# SHELL — Open a shell inside a running container
# Default: web service
# Example: make shell or make shell SERVICE=db
# --------------------------------------------
shell:
	$(EX) "bash"

# --------------------------------------------
# 🧩 DJANGO MANAGEMENT SHORTCUTS
# Run Django management commands directly in the container
# --------------------------------------------
migrate:
	$(EX) "python manage.py migrate"

makemigrations:
	$(EX) "python manage.py makemigrations"

createsuperuser:
	$(EX) "python manage.py createsuperuser"

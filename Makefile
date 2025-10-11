# makefile
# ============================================
# TuChati Makefile Docker Helper Commands
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
EX := $(DC) exec $(SERVICE) bash -lc


# Declare non-file targets
.PHONY: dev prod down logs shell migrate createsuperuser makemigrations

# --------------------------------------------
# DEV Run local development environment
# Uses compose.yml + compose.dev.yml
# --------------------------------------------
dev:
	cd docker && ln -sf ../.env.dev .env && \
	docker compose -f compose.yml -f compose.dev.yml up -d --build


# --------------------------------------------
# PROD Run production stack
# Uses only compose.yml + .env.prod
# --------------------------------------------
prod:
	cd $(DOCKER_DIR) && docker compose -f compose.yml down
	cd $(DOCKER_DIR) && ln -sf ../.env.prod .env && docker compose -f compose.yml up -d --build

# --------------------------------------------
# 🧹 DOWN Stop and remove all containers, networks, etc.
# --------------------------------------------
down:
	cd $(DOCKER_DIR) && docker compose down

# --------------------------------------------
# 🪵 LOGS Follow logs from the web container (by default)
# Change SERVICE=nginx to see Nginx logs, etc.
# Example: make logs SERVICE=nginx
# --------------------------------------------
logs:
	cd $(DOCKER_DIR) && docker compose logs -f $(SERVICE)

# --------------------------------------------
# SHELL Open a shell inside a running container
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

# --------------------------------------------
# 🧠 BASH: Open an interactive bash shell (useful for debugging)
# Example: make bash or make bash SERVICE=nginx
# --------------------------------------------
bash:
	cd $(DOCKER_DIR) && docker compose exec $(SERVICE) bash

# --------------------------------------------
# 🐍 PY: Run a quick Django Python one-liner inside the container
# Example: make py CMD="from django.conf import settings; print(settings.DEBUG)"
# --------------------------------------------
py:
	cd $(DOCKER_DIR) && docker compose exec $(SERVICE) python manage.py shell -c "$(CMD)"

# --------------------------------------------
# GIT PULL
# Pull latest code from main branch while ignoring local images in root
# --------------------------------------------
pull:
	@echo "⚙️  Pulling latest changes from main (ignoring local root images)..."
	# Temporarily stash only tracked changes excluding root images
	git stash push -m "temp-stash" -- $(filter-out ./, $(wildcard ./*)) || true
	# Remove large image files from root before pulling
	find . -maxdepth 1 -type f \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.gif' \) -exec rm -f {} \;
	# Pull latest changes
	git pull origin main
	# Restore stashed files (if any)
	git stash pop || true
	@echo " Pull completed successfully."
# --------------------------------------------
# DB: Open a PostgreSQL interactive shell
# Example: make dbshell or make dbshell SERVICE=db
# --------------------------------------------
dbshell:
	cd $(DOCKER_DIR) && docker compose exec db psql -U $${POSTGRES_USER:-tuchati} $${POSTGRES_DB:-tuchati}

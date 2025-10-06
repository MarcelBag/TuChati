#Dockerfile
# ===========================================
# TuChati Dockerfile (final stable version)
# Multi-stage build for backend + frontend
# Works seamlessly for both dev and prod
# ===========================================

# ===========================================================
# FRONTEND BUILD STAGE
# ===========================================================
FROM node:20-alpine AS frontend-builder

# Set working directory inside the container
WORKDIR /app/frontend/web

# -------------------------------------------
# Install frontend dependencies
# -------------------------------------------
COPY frontend/web/package*.json ./
RUN npm ci

# -------------------------------------------
# Copy React app source and build it
# -------------------------------------------
COPY frontend/web ./
RUN npm run build


# ===========================================================
# BACKEND BUILD STAGE
# ===========================================================
FROM python:3.12-slim AS backend

# -------------------------------------------
# Working directory
# -------------------------------------------
WORKDIR /app

# -------------------------------------------
# Install system dependencies
# -------------------------------------------
RUN apt-get update && apt-get install -y \
    libpq-dev gcc gettext curl dos2unix postgresql-client && \
    rm -rf /var/lib/apt/lists/*

# -------------------------------------------
# Copy Python dependencies and install
# -------------------------------------------
COPY requirements /tmp/requirements
RUN pip install --upgrade pip && \
    pip install -r /tmp/requirements/prod.txt

# -------------------------------------------
# Copy backend project code + entrypoint
# -------------------------------------------
COPY backend /app/backend
COPY docker/entrypoint.sh /entrypoint.sh

# Ensure entrypoint.sh is clean and executable
RUN dos2unix /entrypoint.sh && chmod +x /entrypoint.sh

# -------------------------------------------
# Copy the built frontend into the image
# (Served later by Nginx via mounted volume)
# -------------------------------------------
COPY --from=frontend-builder /app/frontend/web/build /usr/share/nginx/html

# -------------------------------------------
# Expose ASGI port for Django
# -------------------------------------------
EXPOSE 8000

# -------------------------------------------
# Start the backend server
# -------------------------------------------
CMD ["/entrypoint.sh"]

# ===========================================
# TuChati Dockerfile (final stable version)
# Works for both dev and prod builds
# ===========================================

FROM python:3.12-slim

# Set working directory inside the container
WORKDIR /app

# -------------------------------------------
# Install system dependencies
# -------------------------------------------
RUN apt-get update && apt-get install -y \
    libpq-dev gcc gettext curl dos2unix && \
    rm -rf /var/lib/apt/lists/*

# -------------------------------------------
# Copying Python dependencies and install
# -------------------------------------------
COPY requirements /tmp/requirements
RUN pip install --upgrade pip && \
    pip install -r /tmp/requirements/prod.txt

# -------------------------------------------
# Copying project code
# -------------------------------------------
COPY backend /app/backend
COPY docker/entrypoint.sh /entrypoint.sh

# -------------------------------------------
# Ensureing entrypoint.sh is clean + executable
# (prevents "exec format error" on Mac/Windows systems)
# -------------------------------------------
RUN dos2unix /entrypoint.sh && chmod +x /entrypoint.sh

# -------------------------------------------
# ExposingASGI port
# -------------------------------------------
EXPOSE 8000

# -------------------------------------------
# Starting the app
# -------------------------------------------
CMD ["/entrypoint.sh"]

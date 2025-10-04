FROM python:3.12-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y \
    libpq-dev gcc gettext curl && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements /tmp/requirements
RUN pip install --upgrade pip && \
    pip install -r /tmp/requirements/prod.txt

# Copy backend code
COPY backend /app/backend
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

# Expose ASGI port
EXPOSE 8000

CMD ["/entrypoint.sh"]

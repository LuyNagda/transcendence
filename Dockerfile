FROM python:3.9-slim-bookworm
RUN apt-get update
RUN apt-get install -y curl make git libpq-dev

ENV DB_NAME=${DB_NAME}
ENV DB_HOST=${DB_HOST}
ENV DB_USER=${DB_USER}
ENV DB_PASSWORD=${DB_PASSWORD}
ENV DB_PORT=${DB_PORT}

ENV EMAIL_HOST_USER=${EMAIL_HOST_USER}
ENV EMAIL_HOST_PASSWORD=${EMAIL_HOST_PASSWORD}
ENV EMAIL_HOST=${EMAIL_HOST}
ENV DEFAULT_FROM_EMAIL=${DEFAULT_FROM_EMAIL}

COPY . /app

RUN python -m pip install --upgrade pip

RUN python3 -m venv /venv && \
	/venv/bin/pip install -r /app/requirements.txt

WORKDIR /app/

HEALTHCHECK --interval=1s --timeout=30s --retries=30 \
	CMD [ -f /tmp/healthy ] || (curl -f http://localhost:8000/ && touch /tmp/healthy || exit 1)

ENTRYPOINT ["/app/migrate.sh", "/venv/bin/gunicorn"]
CMD ["--bind", "0.0.0.0:8000", "transcendence.wsgi:application"]
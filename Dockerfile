FROM python:3.10-bookworm AS builder

RUN apt-get update && apt-get install -y libpq-dev python3-venv nodejs npm

WORKDIR /app

# Copy only requirements.txt first to leverage Docker cache
COPY requirements.txt .

RUN python3 -m venv /app/.venv
RUN .venv/bin/pip install --upgrade pip && \
	.venv/bin/pip install -r requirements.txt

COPY package.json package-lock.json ./

RUN npm install

FROM python:3.10-bookworm

ENV DB_NAME=${DB_NAME}
ENV DB_HOST=${DB_HOST}
ENV DB_USER=${DB_USER}
ENV DB_PASSWORD=${DB_PASSWORD}
ENV DB_PORT=${DB_PORT}

ENV EMAIL_HOST_USER=${EMAIL_HOST_USER}
ENV EMAIL_HOST_PASSWORD=${EMAIL_HOST_PASSWORD}
ENV EMAIL_HOST=${EMAIL_HOST}
ENV DEFAULT_FROM_EMAIL=${DEFAULT_FROM_EMAIL}

ENV DEBUG=${DEBUG}
ENV DOMAIN=${DOMAIN}

RUN apt-get update && apt-get install -y curl make git libpq-dev openssl nodejs npm

SHELL ["/bin/bash", "-c"]

RUN mkdir /certs
WORKDIR /app

COPY . .
RUN rm -rf /app/.venv /app/node_modules
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/node_modules /app/node_modules

RUN npm run build

RUN chmod +x install.sh

HEALTHCHECK --interval=1s --timeout=30s --retries=30 \
	CMD [ -f /tmp/healthy ] || (curl -f http://localhost:8000/ && touch /tmp/healthy || exit 1)

ENTRYPOINT ["/app/install.sh"]
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "-e", "ssl:443:privateKey=/certs/key.pem:certKey=/certs/cert.pem", "transcendence.asgi:application"]
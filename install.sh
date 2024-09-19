#!/bin/bash
if [ ! -f /certs/key.pem ]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /certs/key.pem -out /certs/cert.pem \
        -subj "/CN=localhost"
fi

source /app/.venv/bin/activate

python /app/manage.py migrate
python /app/manage.py collectstatic --noinput
exec "$@"

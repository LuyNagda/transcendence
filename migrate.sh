#!/bin/bash
source /venv/bin/activate
python /app/manage.py makemigrations
python /app/manage.py migrate
python /app/manage.py collectstatic --noinput
exec "$@"

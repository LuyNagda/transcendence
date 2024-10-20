#!/bin/bash
set -e
set -a
source /app/transcendence/.env
set +a

find /app -path '*/migrations/*.py' -not -path '*/.venv/*' | sort > /app/before_migrations.txt
echo "Before migrations:"
cat /app/before_migrations.txt

python manage.py makemigrations $1

find /app -path '*/migrations/*.py' -not -path '*/.venv/*' | sort > /app/after_migrations.txt
echo "After migrations:"
cat /app/after_migrations.txt

NEW_FILES=$(comm -13 /app/before_migrations.txt /app/after_migrations.txt)

echo "New migration files:"
echo "$NEW_FILES"

for file in $NEW_FILES; do
    echo "Copying $file to /host${file#/app}"
    cp "$file" "/host${file#/app}"
    if [ $? -eq 0 ]; then
        echo "Successfully copied $file"
    else
        echo "Failed to copy $file"
    fi
done

echo "New migration files copied to host."
rm /app/before_migrations.txt /app/after_migrations.txt

exit 0
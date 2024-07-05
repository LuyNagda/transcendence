Start with installing postgresql and create a database named "transcendence"

Create an .env file in transcendence folder where setting.py is located. Provide the email vars.

Startup the db and run the commands in this order:
python manage.py makemigrations
python manage.py migrate
python manage.py runserver

Enjoy :)

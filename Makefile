# **************************************************************************** #
#                                                                              #
#                                                         :::      ::::::::    #
#    Makefile                                           :+:      :+:    :+:    #
#                                                     +:+ +:+         +:+      #
#    By: agaley <agaley@student.42lyon.fr>          +#+  +:+       +#+         #
#                                                 +#+#+#+#+#+   +#+            #
#    Created: 2023/12/15 15:51:13 by agaley            #+#    #+#              #
#    Updated: 2025/03/17 12:04:42 by agaley           ###   ########.fr        #
#                                                                              #
# **************************************************************************** #

SHELL := /bin/bash

NAME = transcendence

ENV_FILE = transcendence/.env

export MY_GID ?= $(id -g)
export BUILD_TYPE ?= prod
export MY_UID ?= $(id -u)
export NGINX_PORT_1 ?= 8000
export NGINX_PORT_2 ?= 8001
export PORT ?= 8080

# Required environment variables
REQUIRED_ENV_VARS = DB_NAME DB_USER DB_PASSWORD EMAIL_HOST EMAIL_PORT \
    EMAIL_HOST_USER EMAIL_HOST_PASSWORD DEFAULT_FROM_EMAIL EMAIL_USE_TLS \
    DEBUG LOG_LEVEL PROD DOMAIN PONG_TRANSPORT_WS \
	RTC_STUN_URL RTC_TURN_URL_1 RTC_TURN_URL_2 RTC_TURN_USERNAME RTC_TURN_CREDENTIAL \
	FT_CLIENT_ID FT_CLIENT_SECRET FT_REDIRECT_URI

SRC_ENV = set -a; source $(ENV_FILE); set +a;

VENV = .venv
PYTHON = $(VENV)/bin/python
PIP = $(VENV)/bin/pip

all: check-env
	$(SRC_ENV) docker compose --profile dev up --build

$(NAME):

run: check-env daemon
	@make logs

daemon: check-env
	pnpm run build && \
	$(SRC_ENV) docker compose --profile prod up --build -d

dev: check-env
	pnpm run dev & \
	$(SRC_ENV) docker compose --profile dev up --build --watch

# Check if all required environment variables are set in .env
check-env:
	@if [ ! -f "$(ENV_FILE)" ]; then \
		echo "Error: .env file not found!"; \
		exit 1; \
	fi; \
	for var in $(REQUIRED_ENV_VARS); do \
		if ! grep -qE "^$$var=" $(ENV_FILE); then \
			echo "Error: Missing required environment variable: $$var"; \
			exit 1; \
		fi; \
	done; \
	echo "✅ All required environment variables are set."

$(VENV)/bin/activate: requirements.txt
	python3 -m venv $(VENV)
	$(PIP) install -r requirements.txt

venv: $(VENV)/bin/activate

makemigrations:
	$(call run_migrations)

# To run for new apps : make makemigrations-app_name
makemigrations-%:
	$(call run_migrations,$*)

migrate: check-env
	$(SRC_ENV) docker compose run --rm transcendence python manage.py migrate
	$(SRC_ENV) docker compose down

db-update: makemigrations migrate

db-clean:
	$(SRC_ENV) docker compose down -v

rebuild:
	$(SRC_ENV) BUILD_TYPE=dev docker compose --profile dev build

logs:
	$(SRC_ENV) docker compose logs -f

stop:
	$(SRC_ENV) docker compose stop

test: stop
	$(SRC_ENV) docker compose --profile dev up --build transcendence-test

siege: stop daemon
	$(MAKE) wait-for-healthy
	echo "init" > siege.log
	docker compose up siege
	# make logs
	@make clean
	cat siege.log

docker-stop:
	$(SRC_ENV) docker compose down

docker-clean:
	docker compose down --rmi local --remove-orphans
	docker rm -f $$(docker ps -a -q --filter "name=aa-transcendence") 2>/dev/null || true

docker-fclean:
	docker system prune -af

clean: docker-stop docker-clean

fclean: db-clean clean docker-fclean

re: fclean all
debug_re: fclean debug

.PHONY: all clean fclean re debug debug_re
.PHONY: env test run daemon dev logs stop
.PHONY: docker-stop docker-fclean run_tests
.PHONY: makemigrations makemigrations-% migrate db-update

define wait-for-healthy
	$(SRC_ENV) \
	while [ "$$(docker inspect --format='{{.State.Health.Status}}' $$container_id)" != "healthy" ]; do \
		echo "Waiting for container $$container_id to become healthy..."; \
		sleep 1; \
	done
endef

define run_migrations
	$(SRC_ENV) \
	echo $(PWD) && \
	container_id=$$(docker compose run --build --remove-orphans -d -v $(PWD):/host transcendence /bin/bash -c "chmod +x /app/makemigrations.sh && /app/makemigrations.sh $(if $(1),$(1))")

endef

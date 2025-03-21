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

SRC_ENV = set -a; source $(ENV_FILE); set +a;

VENV = .venv
PYTHON = $(VENV)/bin/python
PIP = $(VENV)/bin/pip

all:
	$(SRC_ENV) docker compose --profile dev up --build

$(NAME):

run: daemon
	@make logs

daemon:
	pnpm run build && \
	$(SRC_ENV) docker compose --profile prod up --build -d

dev:
	pnpm run dev & \
	$(SRC_ENV) docker compose --profile dev up --build --watch

$(VENV)/bin/activate: requirements.txt
	python3 -m venv $(VENV)
	$(PIP) install -r requirements.txt

venv: $(VENV)/bin/activate

makemigrations:
	$(call run_migrations)

# To run for new apps : make makemigrations-app_name
makemigrations-%:
	$(call run_migrations,$*)

migrate:
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

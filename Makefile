HOST_APP_DIR := $(shell pwd)
DEV_NODE_MODULES := $(HOST_APP_DIR)/node_modules

APPLICATION_CODE_NAME=app
DOCKER_COMPOSE=docker-compose
DOCKER_COMPOSE_RUN=$(DOCKER_COMPOSE) run
DOCKER_COMPOSE_RUN_ENTRYPOINT=$(DOCKER_COMPOSE_RUN) --service-ports --remove-orphans --entrypoint
EXEC=$(DOCKER_COMPOSE_RUN) $(APPLICATION_CODE_NAME)

# DOCKER RELATED COMMANDS
all: dc-up

build: dc-build

init: build all

dc-up:
	$(DOCKER_COMPOSE) up -d

dc-build:
	$(DOCKER_COMPOSE) build

dc-stop:
	$(DOCKER_COMPOSE) stop

dc-down:
	$(DOCKER_COMPOSE) down

d-stats:
	docker stats $(docker inspect -f "{{ .Name }}" $(docker ps -q))

d-clean:
	docker stop $(docker ps -a -q)
	docker rm $(docker ps -a -q)

d-net-purge:
	docker network prune --force

d-prune:
	docker system prune -a

# APP RELATED COMMANDS
app-install:
	$(EXEC) npm ci

app-build:
	$(EXEC) npm run build

app-start:
	$(EXEC) npm run start

app-dev:
	make dc-down
	$(DOCKER_COMPOSE_RUN_ENTRYPOINT) "npm run dev" \
		-v $(HOST_APP_DIR):/app \
		-v $(DEV_NODE_MODULES):/app/node_modules \
		$(APPLICATION_CODE_NAME) \

app-bash-dev:
	make dc-down
	$(DOCKER_COMPOSE_RUN_ENTRYPOINT) "bash" \
		-v $(HOST_APP_DIR):/app \
		-v $(DEV_NODE_MODULES):/app/node_modules \
		$(APPLICATION_CODE_NAME) \

app-bash:
	$(EXEC) bash
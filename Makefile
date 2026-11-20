.PHONY: help dc-build dc-rebuild dc-up dc-up-backend dc-down dc-stop redis minio postgres \
        app-dev app-bash-dev app-bash app-prod services-up clean

HOST_APP_DIR := $(shell pwd)
DEV_NODE_MODULES := $(HOST_APP_DIR)/node_modules

APPLICATION_CODE_NAME=app
DOCKER_COMPOSE=docker-compose
# The recording backend (Redis, MinIO, PostgreSQL) is the compose profile
# `backend`; stop/down/clean name it so they reach those containers too.
DOCKER_COMPOSE_ALL=$(DOCKER_COMPOSE) --profile backend
DOCKER_COMPOSE_UP=$(DOCKER_COMPOSE) up
DOCKER_COMPOSE_RUN=$(DOCKER_COMPOSE) run --rm
DOCKER_COMPOSE_RUN_ENTRYPOINT=$(DOCKER_COMPOSE_RUN) --service-ports --entrypoint
EXEC=$(DOCKER_COMPOSE_RUN) $(APPLICATION_CODE_NAME)

# ─── Help ──────────────────────────────────────────────────────────────────
help: ## Show this help message
	@echo "Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make app-dev          - Start dev server in Docker with hot reload"
	@echo "  make app-bash-dev     - Open bash in dev container with mounted code"
	@echo "  make services-up      - Start only infrastructure (Redis, MinIO, PostgreSQL)"
	@echo ""
	@echo "Production:"
	@echo "  make dc-build         - Build Docker images"
	@echo "  make dc-rebuild       - Rebuild Docker images without cache"
	@echo "  make dc-up            - Start the app alone (no recording backend)"
	@echo "  make dc-up-backend    - Start the app with Redis, MinIO and PostgreSQL"
	@echo "  make app-prod         - Build and start production server"
	@echo ""
	@echo "Docker Services:"
	@echo "  make redis            - Start only Redis"
	@echo "  make minio            - Start only MinIO"
	@echo "  make postgres         - Start only PostgreSQL"
	@echo ""
	@echo "Utilities:"
	@echo "  make dc-down          - Stop all services"
	@echo "  make dc-stop          - Stop services without removing containers"
	@echo "  make app-bash         - Open bash in running app container"
	@echo "  make clean            - Stop services and remove volumes"
	@echo ""

# ─── Docker Build ──────────────────────────────────────────────────────────
dc-build: ## Build Docker images
	$(DOCKER_COMPOSE) build

dc-rebuild: ## Rebuild Docker images without cache
	$(DOCKER_COMPOSE) build --no-cache

# ─── Docker Services ───────────────────────────────────────────────────────
dc-up: ## Start the app alone (no recording backend)
	$(DOCKER_COMPOSE_UP) -d

dc-up-backend: ## Start the app with the recording backend (set BACKEND_RECORDING=true)
	$(DOCKER_COMPOSE_ALL) up -d

dc-stop: ## Stop services without removing containers
	$(DOCKER_COMPOSE_ALL) stop

dc-down: ## Stop and remove all containers
	$(DOCKER_COMPOSE_ALL) down

services-up: ## Start only infrastructure services (Redis, MinIO, PostgreSQL)
	$(DOCKER_COMPOSE_UP) -d redis minio postgres

redis: ## Start only Redis
	$(DOCKER_COMPOSE_UP) -d redis

minio: ## Start only MinIO
	$(DOCKER_COMPOSE_UP) -d minio

postgres: ## Start only PostgreSQL
	$(DOCKER_COMPOSE_UP) -d postgres

# ─── Development ───────────────────────────────────────────────────────────
app-dev: ## Start development server in Docker with hot reload
	@echo "Starting development server with mounted local code..."
	@echo "Note: This mounts your local code and node_modules for hot reload"
	$(DOCKER_COMPOSE_RUN_ENTRYPOINT) "sh -c 'npx prisma generate && npm run dev'" \
		-v $(HOST_APP_DIR):/app \
		-v $(DEV_NODE_MODULES):/app/node_modules \
		$(APPLICATION_CODE_NAME)

app-bash-dev: ## Open bash in dev container with mounted code
	$(DOCKER_COMPOSE_RUN_ENTRYPOINT) "bash" \
		-v $(HOST_APP_DIR):/app \
		-v $(DEV_NODE_MODULES):/app/node_modules \
		$(APPLICATION_CODE_NAME)

app-bash: ## Open bash in running app container
	docker-compose exec $(APPLICATION_CODE_NAME) bash

# ─── Production ────────────────────────────────────────────────────────────
app-prod: dc-rebuild dc-up ## Rebuild and start production server
	@echo "Production server started"
	@echo "App: http://localhost:3000"

# ─── Cleanup ───────────────────────────────────────────────────────────────
clean: ## Stop services and remove volumes
	$(DOCKER_COMPOSE_ALL) down -v
	@echo "Cleaned up containers and volumes"

# ─── Legacy Aliases ────────────────────────────────────────────────────────
all: dc-up
stop: dc-down
build: dc-build
init: build all
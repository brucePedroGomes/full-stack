# Run the whole app with Docker. Type `make help` to see the commands.
# Dev and prod-local use the same containers: starting one mode replaces the other.
# prod-local only simulates production on this computer. It is not a deploy.
# `migrate` and `seed` run in whichever mode is up.
# On a clean clone, `make dev` or `make prod-local` also creates backend/.env for local testing.

DEV  := docker compose -f compose.dev.yaml
PROD := docker compose -f compose.prod-local.yaml

# The dev frontend's node_modules volume. Each start makes a new one,
# so dev, prod-local, and down delete the old one when it is no longer used.
NODE_MODULES_VOLUME = docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/node_modules"}}{{.Name}}{{end}}{{end}}' $$($(DEV) ps -aq frontend) 2>/dev/null
REMOVE_OLD_VOLUME = { [ -z "$$old" ] || [ "$$old" = "$$($(NODE_MODULES_VOLUME))" ] || docker volume rm "$$old" >/dev/null; }

.DEFAULT_GOAL := help
.PHONY: help install dev prod-local down logs ps migrate seed urls

help: ## Show all commands
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-11s %s\n", $$1, $$2}'

install: ## Install local packages for the IDE (backend/.venv, frontend/node_modules)
	@command -v uv >/dev/null || { echo "Missing uv. Install it: https://docs.astral.sh/uv/getting-started/installation/"; exit 1; }
	@command -v npm >/dev/null || { echo "Missing Node.js. Install Node $$(cat frontend/.nvmrc) (for example with nvm)."; exit 1; }
	cd backend && uv sync --locked
	cd frontend && npm ci

dev: backend/.env ## Start dev mode: build, migrate, seed (stops prod-local)
	@echo "==> Starting dev mode (hot reload)"
	@# Fresh node_modules from the image, so new npm packages appear.
	@old=$$($(NODE_MODULES_VOLUME)); \
	$(DEV) up -d --build --wait --remove-orphans --renew-anon-volumes && $(REMOVE_OLD_VOLUME)
	@$(MAKE) --no-print-directory migrate seed
	@$(MAKE) --no-print-directory urls APP=http://localhost:5173

prod-local: backend/.env ## Simulate production locally, not a deploy (stops dev)
	@echo "==> Starting prod-local mode: built images and nginx, on this computer only."
	@echo "    This is NOT a production deploy."
	@old=$$($(NODE_MODULES_VOLUME)); \
	$(PROD) up -d --build --wait --remove-orphans && $(REMOVE_OLD_VOLUME)
	@$(MAKE) --no-print-directory migrate seed
	@$(MAKE) --no-print-directory urls APP=http://localhost:8080

down: ## Stop everything (keeps the database)
	@old=$$($(NODE_MODULES_VOLUME)); \
	$(DEV) down --remove-orphans && $(REMOVE_OLD_VOLUME)

logs: ## Follow logs of all services together. One service: make logs s=web
	$(DEV) logs -f --tail=100 $(s)

ps: ## Show the containers
	$(DEV) ps

migrate: ## Run Django migrations
	$(DEV) exec web python manage.py migrate --noinput

seed: ## Create demo data if missing (only when DEBUG=true)
	@# Exit 10 means DEBUG is false. Any other error stops make.
	@$(DEV) exec -T web python manage.py shell -v 0 -c "from django.conf import settings; raise SystemExit(0 if settings.DEBUG else 10)"; \
	status=$$?; \
	if [ $$status -eq 0 ]; then $(DEV) exec -T web python manage.py seed_demo; \
	elif [ $$status -eq 10 ]; then echo "Skipped demo data: DEBUG is false in backend/.env."; \
	else echo "Could not check DEBUG in the web container (exit $$status). See: make logs s=web"; exit 1; fi

urls: ## Show the app, API, and Grafana links
	@echo ""
	@echo "  App:      $(or $(APP),http://localhost:5173 (dev) / http://localhost:8080 (prod-local))"
	@echo "  API:      http://localhost:8000/api/"
	@echo "  Grafana:  http://localhost:3000/d/challenge-overview"
	@echo "            user admin, password $$(sed -n 's/^GRAFANA_ADMIN_PASSWORD=//p' backend/.env) (from backend/.env)"
	@echo ""

# Runs only when backend/.env is missing. It never changes an existing file.
backend/.env:
	@sh scripts/create-local-env.sh

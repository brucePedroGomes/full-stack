A task manager for teams. Sign in, then create, edit, assign, and move tasks
across a board: Planned, To do, In progress, Blocked, and Done.
You can search tasks and filter them by status, assignee, or due date. Each
board column shows one status. The due date filter shows overdue tasks or
tasks due in the next 7 days. When a task is assigned to someone, they get an
email from a background job.

## Tech stack

| Part | Tools | Docs |
|---|---|---|
| Frontend | React, TypeScript, Vite, TanStack Query, Tailwind CSS | [Frontend](docs/frontend/frontend.md) |
| Backend | Django, Django REST framework, JWT, Gunicorn, Celery, PostgreSQL 17, Redis | [Backend](docs/backend/backend.md), [Django](docs/backend/django.md), [Auth](docs/backend/auth.md), [Gunicorn](docs/backend/gunicorn.md), [Workers](docs/backend/workers.md) |
| Monitoring | OpenTelemetry, Grafana (logs, metrics, traces) | [Monitoring](docs/backend/monitoring.md) |
| Run | Docker Compose, nginx | [Run it](#run-it) |

## Run it

You need Docker Engine or Docker Desktop with Docker Compose v2 and `make`.
The Compose files use `include`, so use [Compose 2.20.3 or newer](https://docs.docker.com/compose/how-tos/multiple-compose-files/include/).
Run commands from the repository root.

> **`prod-local` is not a production deploy.** It only simulates production on your
> computer, to test a clean build: the real images, no code mounts, no hot reload,
> and nginx in front. The settings, database, and Grafana are all local. Never use
> these files or the generated `backend/.env` in a real environment.

## Which mode should I use?

**First time here? Start with `make prod-local`.**

It is the cleanest way to try the app for real:

- It runs the same images a real deploy builds.
- The frontend is the final build: minified and served by nginx.
- There is no hot reload or file watching, so speed is closer to real use.
- If it works here, the build works.

**Use `make dev` when you change code.** Your changes appear right away, without a rebuild.

Each command does every step: it builds the images, starts the containers,
runs migrations, and creates the demo data if it is missing. Then it prints the links.
Starting one mode stops the other. Both modes use the same database.

On a clean clone, the first `make prod-local` or `make dev` also creates `backend/.env`
with new random secrets. That file is for local testing only: plain HTTP, debug on,
console email. 

| | Dev | Prod-local |
|---|---|---|
| App | http://localhost:5173 | http://localhost:8080 |
| API | http://localhost:8000/api/ | http://localhost:8000/api/ |
| Grafana | http://localhost:3000/d/challenge-overview | same |

- Grafana user is `admin`. `make urls` shows the password from `backend/.env`.
- Demo login: `bruce-gomes` / `Tempo-demo-2026!`. Demo data is only created when `DJANGO_DEBUG=true`.
- Swagger UI: http://localhost:8000/api/docs/. The [API guide](docs/backend/api.md) includes request examples.

## Review and testing

- [Testing](docs/backend/testing.md): commands, coverage, and the real app test.
- [API documentation choice](docs/backend/drf-spectacular.md): why I use drf-spectacular.

After starting the app, run `make install`, `make test`, and `make check-backend`.
Backend coverage must stay at or above 80%. The testing guide explains the browser checks.

## Admin user

The Django admin is at http://localhost:8000/admin/. To create the admin user `bruce`,
run this while `make dev` or `make prod-local` is up:

```sh
docker compose -f compose.dev.yaml exec web python manage.py createsuperuser --username bruce
```

It asks for an email and a password. The same command works in both modes.

## How the files fit together

| File | What it runs |
|---|---|
| `docker-compose.yml` | Default entry point for the full dev stack. |
| `backend/compose.infra.yaml` | Postgres, Redis, and Grafana. The same in both modes. |
| `backend/compose.yaml` | Infra + backend in dev style. Also works alone, from `backend/`. |
| `compose.dev.yaml` | `backend/compose.yaml` + the Vite dev server. |
| `compose.prod-local.yaml` | Infra + backend images + nginx with the frontend build. Local only. |

## IDE setup

The containers do not need local packages. Your IDE does, to find imports:

```sh
make install   # creates backend/.venv and frontend/node_modules
```

It needs [uv](https://docs.astral.sh/uv/) (it downloads Python 3.14 by itself) and
Node.js. `frontend/.nvmrc` has the same Node version as Docker: run `nvm use` in `frontend/`.

## Logs

- `make logs` shows the logs of all services together, in one stream.
- `make logs s=web` shows one service (`web`, `worker`, `frontend`, `postgres`, `redis`, `lgtm`).
- Grafana also stores the API and worker logs, linked to their traces.

Stop everything with `make down`. It keeps the database. 

## Without make

```sh
sh scripts/create-local-env.sh
docker compose up -d --build --wait
docker compose exec web python manage.py migrate --noinput
docker compose exec web python manage.py seed_demo
```

For prod-local, use `docker compose -f compose.prod-local.yaml` in the three
Docker commands above. Open http://localhost:8080 instead of port 5173.

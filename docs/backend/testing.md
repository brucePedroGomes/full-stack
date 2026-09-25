Testing

I use Django's unittest runner for the backend, Vitest for frontend unit tests, and Playwright for browser tests. The backend tests cover task operations, permissions, JWT, CSRF, filters, pagination, rate limits, email jobs, and settings. Coverage includes branches and the separate processes used by the telemetry tests.

Start the app with `make dev` or `make prod-local`, then run these commands from the repository root:

```sh
make install
make test
make check-backend
```

`make test` runs the backend tests with coverage, then frontend unit tests, lint, and the production build. `make check-backend` checks Python types, missing migrations, and the OpenAPI schema. Backend coverage fails below 80%. Open `backend/htmlcov/index.html` for the full report; `backend/coverage.xml` is available for CI tools.

Tests create and remove a separate PostgreSQL test database. The normal API tests use an in-memory cache, so they do not use the running app's rate limits. The telemetry checks use local Redis database 15. The database password comes from `backend/.env`. These commands are for the local Compose setup.

The coverage report measures `config`, `tasks`, and `users`, including startup files. It excludes test code and migrations. It measures which code runs, not whether every possible behavior is correct. See [Django's coverage guidance](https://docs.djangoproject.com/en/6.1/topics/testing/advanced/#integration-with-coverage-py).

Install the Playwright browser once, then run the browser tests:

```sh
cd frontend
npx playwright install chromium
cd ..
make test-e2e
make test-live
```

On Linux, Playwright may also require browser system packages. Its install command will list any missing packages.

`make test-e2e` uses a simulated API. It covers failed requests, token renewal, keyboard controls, and phone layouts. `make test-live` uses the running app and the demo credentials. It creates one temporary task, assigns it, edits it, checks that changes survive a reload, marks it done, deletes it, and signs out. It also checks for unexpected browser warnings and errors. A fresh browser's expected 401 while restoring an anonymous session is excluded.

For prod-local:

```sh
LIVE_APP_URL=http://localhost:8080 make test-live
```

The live test uses the demo account `bruce-gomes` and assigns its temporary task to `bruno`. Run it only on the seeded local app. It removes only the task it created. For assignment email output, check `make logs s=worker`; local email is printed to the console.

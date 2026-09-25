API

The API uses JWT bearer tokens. Open http://localhost:8000/api/docs/ for Swagger UI or http://localhost:8000/api/schema/ for the schema. Local setup enables both. The browser session endpoints are regular Django views and are described below; they are not included in the generated DRF schema.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/token/` | Get access and refresh tokens with a username and password. |
| POST | `/api/auth/token/refresh/` | Get a new access token with a refresh token. |
| GET, POST | `/api/tasks/` | List or create tasks. |
| GET, PUT, PATCH, DELETE | `/api/tasks/{id}/` | Read, edit, or delete a task. |
| PATCH | `/api/tasks/{id}/status/` | Change only its status. |
| GET | `/api/users/` | List users for assignment. |
| GET | `/api/users/me/` | Read the signed-in account. |
| GET | `/api/auth/browser/csrf/` | Set the CSRF cookie. |
| POST | `/api/auth/browser/login/` | Sign in with form data and return an access JWT. |
| POST | `/api/auth/browser/token/` | Get an access JWT from the saved Django session. |
| POST | `/api/auth/browser/logout/` | End the Django session. |

Browser POST requests need the `X-CSRFToken` header and cookies. All task and user endpoints require `Authorization: Bearer <access token>`. Every signed-in user belongs to one shared team and can see, edit, assign, complete, or delete every task.

Get a token with the local demo account:

```sh
curl -s http://localhost:8000/api/auth/token/ \
  -H 'Content-Type: application/json' \
  -d '{"username":"bruce-gomes","password":"Tempo-demo-2026!"}'
```

Copy the returned access token into `TOKEN` in your terminal. In Swagger UI, use **Authorize** and enter the access token. Create a task:

```sh
curl -s http://localhost:8000/api/tasks/ \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Prepare the demo","description":"Explain the API","due_date":"2026-10-01","assigned_to":null}'
```

Tasks start as `planned` unless creation includes another valid status. The statuses are `planned`, `to_do`, `in_progress`, `blocked`, and `done`. Use a real user ID from `/api/users/` to assign a task. Use `null` to clear an assignee or due date. The API sets `created_by` from the authenticated user and does not accept a different creator from the client.

Use the returned task ID in this status request:

```sh
curl -s http://localhost:8000/api/tasks/123/status/ \
  -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"status":"done"}'
```

The normal detail endpoint treats `status` as read-only. Use the status endpoint above to mark an existing task done.

| Query parameter | Meaning |
|---|---|
| `status=done` | One status. |
| `due_date=2026-10-01` | An exact due date. |
| `due_after=2026-10-01` | Due on or after this date. |
| `due_before=2026-10-31` | Due on or before this date. |
| `due=overdue` | Past due and not done. |
| `due=next7` | Due today or in the following six days. |
| `assigned_to=3` | Assigned to this user. |
| `unassigned=true` | No assignee. |
| `search=demo` | Search title and description. |
| `page=2&page_size=20` | Select a page and its size, capped at 100. |
| `ordering=-updated_at,-id` | Most recently changed first; this is the default. |

Filters can be combined. Dates use the team's `America/Sao_Paulo` timezone. Past due dates are allowed so overdue work can be tracked. Tasks have 20 items per page by default; users have 10. Lists return `count`, `next`, `previous`, and `results`.

Invalid fields return 400, missing or invalid authentication returns 401, and missing records return 404. Successful deletion returns 204. Rate limits return 429 with `Retry-After`. The normal limits are 120 requests per minute per signed-in user, 60 per minute for anonymous requests, and 10 per minute for the shared login/token scope. Browser CSRF setup has its own limit of 60 per minute.

Authentication: cookies and JWT

JWT authentication is required for my API. I keep the access JWT in React memory and use an `HttpOnly` Django session cookie to get new tokens. This lets login survive a reload without saving JWTs in `localStorage`.\
Without the session cookie, I would need another way to restore login after a reload.


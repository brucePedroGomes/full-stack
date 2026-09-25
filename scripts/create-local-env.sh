#!/bin/sh
# Create backend/.env for local testing, with new random secrets.
# Local only: plain HTTP, debug on, console email, demo data allowed.
# It never changes an existing file.
set -eu

example=backend/.env.example
target=backend/.env

if [ -e "$target" ]; then
  echo "$target already exists. Nothing changed."
  exit 0
fi

# Random hex string. $1 = number of bytes (the result has 2x that many characters).
random_hex() {
  head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'
}

sed \
  -e "s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=$(random_hex 50)|" \
  -e "s|^DJANGO_PASSWORD_PEPPER=.*|DJANGO_PASSWORD_PEPPER=$(random_hex 32)|" \
  -e "s|^DJANGO_JWT_SIGNING_KEY=.*|DJANGO_JWT_SIGNING_KEY=$(random_hex 32)|" \
  -e "s|^DB_PASSWORD=.*|DB_PASSWORD=$(random_hex 24)|" \
  -e "s|^GRAFANA_ADMIN_PASSWORD=.*|GRAFANA_ADMIN_PASSWORD=$(random_hex 16)|" \
  -e "s|^DJANGO_DEBUG=.*|DJANGO_DEBUG=true|" \
  -e "s|^DJANGO_ENABLE_API_DOCS=.*|DJANGO_ENABLE_API_DOCS=true|" \
  -e "s|^DJANGO_SECURE_SSL_REDIRECT=.*|DJANGO_SECURE_SSL_REDIRECT=false|" \
  -e "s|^DJANGO_SESSION_COOKIE_SECURE=.*|DJANGO_SESSION_COOKIE_SECURE=false|" \
  -e "s|^DJANGO_CSRF_COOKIE_SECURE=.*|DJANGO_CSRF_COOKIE_SECURE=false|" \
  -e "s|^DJANGO_EMAIL_FROM=.*|DJANGO_EMAIL_FROM=webmaster@localhost|" \
  "$example" > "$target"

echo "Created $target for local testing (HTTP, debug on, new random secrets)."

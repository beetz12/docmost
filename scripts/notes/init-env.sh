#!/usr/bin/env bash
# Creates a local .env for docker-compose.notes.yml with freshly generated secrets.
# .env is gitignored. Refuses to overwrite an existing .env.
set -euo pipefail
cd "$(dirname "$0")/../.."
if [ -e .env ]; then
  echo ".env already exists; leaving it alone." >&2
  exit 0
fi
umask 077
cat > .env <<ENV
APP_URL=${APP_URL:-http://localhost:3000}
APP_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_TOKEN_EXPIRES_IN=30d
STORAGE_DRIVER=local
MAIL_DRIVER=smtp
DISABLE_TELEMETRY=true
# BIND_ADDR=127.0.0.1
# APP_PORT=3000
ENV
echo "Wrote .env (secrets generated locally)."

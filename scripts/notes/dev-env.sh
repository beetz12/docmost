#!/usr/bin/env bash
# Source this to point the server/client at the dev database from docker-compose.notes-dev.yml.
export PORT=3100
export APP_URL=http://localhost:3100
export DATABASE_URL=postgresql://docmost:devpassword@127.0.0.1:5433/docmost
export REDIS_URL=redis://127.0.0.1:6380
export DISABLE_TELEMETRY=true

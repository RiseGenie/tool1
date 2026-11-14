#!/usr/bin/env bash
# Runs the integration tests against a local dev server, a throwaway database and filesystem storage.
set -euo pipefail
cd "$(dirname "$0")/.."
export DATABASE_URL=${TEST_DATABASE_URL:-$(scripts/dev-db.sh start | tail -1 | sed 's#/recorder$#/rgtest#')}
PSQL="/usr/lib/postgresql/16/bin/psql"
run() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
run "$PSQL -h /tmp -p 54329 -U rg -d postgres -qc 'drop database if exists rgtest with (force)' -c 'create database rgtest'" 2>/dev/null
npx tsx scripts/migrate.ts >/dev/null
export FS_STORAGE_DIR=/tmp/rg-test-storage; rm -rf "$FS_STORAGE_DIR"
export STORAGE_DRIVER=fs TRANSCRIBE_PROVIDER=mock APP_SECRET=test-secret DEV_AUTH=1
PORT=3200
pkill -f "next dev" 2>/dev/null || true; pkill -f "next-server" 2>/dev/null || true; sleep 1
# Dev auth is hard-disabled when NODE_ENV=production, so the test server runs in development mode.
npx next dev -p $PORT >/tmp/rg-test-server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true; pkill -f "next-server" || true; pkill -f "next dev" || true' EXIT
for i in $(seq 1 90); do curl -fs "http://127.0.0.1:$PORT/api/share/$(printf 'a%.0s' {1..32})" -o /dev/null -w '%{http_code}' 2>/dev/null | grep -q 404 && break; sleep 1; done
TEST_BASE_URL="http://127.0.0.1:$PORT" npx tsx --test --test-concurrency=1 "${@:-tests/*.test.ts}"

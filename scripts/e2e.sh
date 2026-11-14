#!/usr/bin/env bash
# Phase 1 acceptance test: Postgres + app + worker + headless Chromium (fake devices, real tab capture).
set -euo pipefail
cd "$(dirname "$0")/.."
export DATABASE_URL=$(scripts/dev-db.sh start | tail -1 | sed 's#/recorder$#/rgtest#')
PSQL=/usr/lib/postgresql/16/bin/psql
run() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
run "$PSQL -h /tmp -p 54329 -U rg -d postgres -qc 'drop database if exists rgtest with (force)' -c 'create database rgtest'" 2>/dev/null
npx tsx scripts/migrate.ts >/dev/null
export FS_STORAGE_DIR=/tmp/rg-test-storage; rm -rf "$FS_STORAGE_DIR"
export STORAGE_DRIVER=fs TRANSCRIBE_PROVIDER=mock APP_SECRET=test-secret DEV_AUTH=1
export BUG_TRACKER=github GITHUB_TOKEN=test-token GITHUB_REPO=acme/app GITHUB_API_URL=http://127.0.0.1:3299 PORT=3200
pkill -f "next dev" 2>/dev/null || true; pkill -f "next-server" 2>/dev/null || true; sleep 1
pkill -f "next-server" 2>/dev/null || true; pkill -f "next dev" 2>/dev/null || true; sleep 1
npx next dev -p 3200 >/tmp/rg-e2e-server.log 2>&1 & SERVER=$!
npx tsx worker/index.ts >/tmp/rg-e2e-worker.log 2>&1 & WORKER=$!
trap 'kill $SERVER $WORKER 2>/dev/null || true; pkill -f "next-server" || true; pkill -f "next dev" || true' EXIT
for i in $(seq 1 90); do curl -fs -o /dev/null "http://127.0.0.1:3200/login" && break; sleep 1; done
curl -fs -o /dev/null "http://127.0.0.1:3200/app/record" -b "x=1" || true   # warm the compile
rc=0
for t in ${E2E_ONLY:-acceptance review requests bug}; do
  echo "=== $t"; node tests/e2e/$t.mjs || rc=1
done
exit $rc

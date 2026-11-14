#!/usr/bin/env bash
# Starts a throwaway local PostgreSQL 16 on port 54329 (for dev/tests where Docker isn't available).
# Usage: scripts/dev-db.sh start|stop|url
set -euo pipefail
BIN=/usr/lib/postgresql/16/bin
DIR=${PGDATA_DIR:-/tmp/rg-pgdata}
PORT=${PGPORT_DEV:-54329}
run() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
case "${1:-start}" in
  start)
    if [ ! -d "$DIR" ]; then mkdir -p "$DIR"; chown postgres "$DIR" 2>/dev/null || true; run "$BIN/initdb -D $DIR -A trust -U rg >/dev/null"; fi
    run "$BIN/pg_ctl -D $DIR -o '-p $PORT -k /tmp' -l $DIR/log -w start" >/dev/null || true
    run "$BIN/psql -h /tmp -p $PORT -U rg -d postgres -tc \"select 1 from pg_database where datname='recorder'\"" | grep -q 1 || run "$BIN/createdb -h /tmp -p $PORT -U rg recorder"
    echo "postgres://rg@127.0.0.1:$PORT/recorder" ;;
  stop) run "$BIN/pg_ctl -D $DIR -m fast stop" ;;
  url) echo "postgres://rg@127.0.0.1:$PORT/recorder" ;;
esac

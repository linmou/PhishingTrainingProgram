#!/bin/sh
# Load the configured Supabase PostgreSQL source for local export scripts.
REPO_DIR=$(CDPATH= cd "$DATABASE_DIR/../.." && pwd)
ENV_FILE=${PG_DUMP_ENV_FILE:-"$REPO_DIR/.env"}

if [ -z "${PGPASSWORD:-}" ] && [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

: "${PGPASSWORD:?Set PGPASSWORD in $ENV_FILE or export it before running this script}"

PGHOST=${PGHOST:-aws-0-us-east-2.pooler.supabase.com}
PGPORT=${PGPORT:-5432}
PGUSER=${PGUSER:-postgres.zgbufaxooqxeabewktzd}
PGDATABASE=${PGDATABASE:-postgres}
PGSSLMODE=${PGSSLMODE:-require}
if [ -z "${PGCLIENT_BIN_DIR:-}" ]; then
  for candidate in /opt/homebrew/opt/postgresql@17/bin /usr/local/opt/postgresql@17/bin "$HOME/Applications/Postgres.app/Contents/Versions/17/bin" /Applications/Postgres.app/Contents/Versions/17/bin; do
    if [ -x "$candidate/pg_dump" ]; then PGCLIENT_BIN_DIR=$candidate; break; fi
  done
  : "${PGCLIENT_BIN_DIR:?Install PostgreSQL 17 or set PGCLIENT_BIN_DIR}"
fi
PG_DUMP_DIR=${PG_DUMP_DIR:-"$HOME/.transfer-assessment-pg17"}
export PGHOST PGPORT PGUSER PGDATABASE PGSSLMODE

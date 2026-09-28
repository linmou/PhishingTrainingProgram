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
PGCLIENT_BIN_DIR=${PGCLIENT_BIN_DIR:-/opt/homebrew/opt/postgresql@17/bin}
PG_DUMP_DIR=${PG_DUMP_DIR:-"$HOME/.transfer-assessment-pg17"}
export PGHOST PGPORT PGUSER PGDATABASE PGSSLMODE

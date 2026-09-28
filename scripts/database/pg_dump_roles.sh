#!/bin/sh
# Export source role definitions and memberships without password hashes.
set -eu
umask 077
DATABASE_DIR=${DATABASE_DIR:-$(CDPATH= cd "$(dirname "$0")" && pwd)}
. "$DATABASE_DIR/connection.sh"

if [ ! -x "$PGCLIENT_BIN_DIR/pg_dumpall" ]; then
  echo "PostgreSQL 17 pg_dumpall is unavailable: $PGCLIENT_BIN_DIR/pg_dumpall" >&2
  exit 127
fi
mkdir -p "$PG_DUMP_DIR"

"$PGCLIENT_BIN_DIR/pg_dumpall" \
  -w -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -l "$PGDATABASE" \
  --roles-only --no-role-passwords \
  --file="$PG_DUMP_DIR/source-roles.sql"
echo "Roles created successfully: $PG_DUMP_DIR/source-roles.sql"

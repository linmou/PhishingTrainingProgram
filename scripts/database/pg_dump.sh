#!/bin/sh
# Replace the local application-schema snapshot using the shared source connection.
set -eu
umask 077
DATABASE_DIR=${DATABASE_DIR:-$(CDPATH= cd "$(dirname "$0")" && pwd)}
. "$DATABASE_DIR/connection.sh"

if [ ! -x "$PGCLIENT_BIN_DIR/pg_dump" ]; then
  echo "PostgreSQL 17 pg_dump is unavailable: $PGCLIENT_BIN_DIR/pg_dump" >&2
  exit 127
fi
mkdir -p "$PG_DUMP_DIR"

"$PGCLIENT_BIN_DIR/pg_dump" \
  -w -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  --format=custom --schema=public --schema=private \
  --file="$PG_DUMP_DIR/phishingtutor.dump"
echo "Dump created successfully: $PG_DUMP_DIR/phishingtutor.dump"

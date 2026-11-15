#!/bin/sh
# Prepare a local-only PostgreSQL validation cluster; never touches a hosted database.
set -eu
umask 077

PG_VALIDATION_ROOT=${PG_VALIDATION_ROOT:-"$HOME/.transfer-assessment-pg17/migration-validation"}
PG_VALIDATION_PORT=${PG_VALIDATION_PORT:-55433}
PG_VALIDATION_BIN_DIR=${PG_VALIDATION_BIN_DIR:-${PGCLIENT_BIN_DIR:-}}
if [ -z "$PG_VALIDATION_BIN_DIR" ]; then
  for candidate in /opt/homebrew/opt/postgresql@17/bin /usr/local/opt/postgresql@17/bin "$HOME/Applications/Postgres.app/Contents/Versions/17/bin" /Applications/Postgres.app/Contents/Versions/17/bin; do
    if [ -x "$candidate/initdb" ]; then PG_VALIDATION_BIN_DIR=$candidate; break; fi
  done
fi
case "$PG_VALIDATION_ROOT" in /*) ;; *) echo 'Validation root must be absolute' >&2; exit 1;; esac
case "$PG_VALIDATION_ROOT" in *"'"*) echo 'Validation root cannot contain single quotes' >&2; exit 1;; esac
case "$PG_VALIDATION_PORT" in ''|*[!0-9]*) echo 'Invalid validation port' >&2; exit 1;; esac
for tool in initdb pg_ctl pg_isready psql; do
  if [ ! -x "$PG_VALIDATION_BIN_DIR/$tool" ]; then echo "Missing PostgreSQL tool: $tool (set PG_VALIDATION_BIN_DIR)" >&2; exit 1; fi
done
case "$("$PG_VALIDATION_BIN_DIR/pg_ctl" --version)" in *' 17.'*) ;; *) echo 'PostgreSQL 17 is required' >&2; exit 1;; esac
mkdir -p "$PG_VALIDATION_ROOT/socket"
chmod 700 "$PG_VALIDATION_ROOT" "$PG_VALIDATION_ROOT/socket"
if [ ! -f "$PG_VALIDATION_ROOT/data/PG_VERSION" ]; then
  "$PG_VALIDATION_BIN_DIR/initdb" -D "$PG_VALIDATION_ROOT/data" -U local_bootstrap --encoding=UTF8 --locale=C --auth-local=trust --auth-host=reject
fi
if [ "$(cat "$PG_VALIDATION_ROOT/data/PG_VERSION")" != 17 ]; then echo 'Existing cluster version mismatch' >&2; exit 1; fi
if ! "$PG_VALIDATION_BIN_DIR/pg_ctl" -D "$PG_VALIDATION_ROOT/data" status >/dev/null 2>&1; then
  "$PG_VALIDATION_BIN_DIR/pg_ctl" -D "$PG_VALIDATION_ROOT/data" -l "$PG_VALIDATION_ROOT/server.log" \
    -o "-c listen_addresses='' -c unix_socket_directories='$PG_VALIDATION_ROOT/socket' -p $PG_VALIDATION_PORT" -w start
fi
# Clear ambient libpq routing and credentials; this connection must stay local.
unset PGHOSTADDR PGSERVICE PGSERVICEFILE PGPASSWORD
"$PG_VALIDATION_BIN_DIR/psql" -X -v ON_ERROR_STOP=1 -h "$PG_VALIDATION_ROOT/socket" -p "$PG_VALIDATION_PORT" -U local_bootstrap -d postgres \
  -c "SELECT version(), current_user, current_setting('listen_addresses'), current_setting('data_directory');"
printf 'Validation socket: %s\nValidation port: %s\nPostgreSQL binaries: %s\n' "$PG_VALIDATION_ROOT/socket" "$PG_VALIDATION_PORT" "$PG_VALIDATION_BIN_DIR"

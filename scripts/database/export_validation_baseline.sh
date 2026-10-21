#!/bin/sh
# Export a private, immutable-per-run baseline using the existing repo helpers.
# This script never overwrites another run's snapshot or starts Docker.
set -eu
umask 077

HERE=$(CDPATH= cd "$(dirname "$0")" && pwd)
PG_VALIDATION_RUN_ROOT=${PG_VALIDATION_RUN_ROOT:-$HOME/.transfer-assessment-pg17/runs}
mkdir -p "$PG_VALIDATION_RUN_ROOT"
RUN_DIR=$(mktemp -d "$PG_VALIDATION_RUN_ROOT/baseline.XXXXXXXX")
printf 'Export incomplete; restore/role parity has not been verified.\n' > "$RUN_DIR/.incomplete"

if ! PG_DUMP_DIR="$RUN_DIR" sh "$HERE/pg_dump.sh" >&2; then
  echo "Application export failed; incomplete run: $RUN_DIR" >&2
  exit 1
fi
if ! PG_DUMP_DIR="$RUN_DIR" sh "$HERE/pg_dump_roles.sh" >&2; then
  echo "Role export failed; parity blocked; incomplete run: $RUN_DIR" >&2
  exit 1
fi
if [ ! -s "$RUN_DIR/phishingtutor.dump" ] || [ ! -s "$RUN_DIR/source-roles.sql" ]; then
  echo "Exporter returned an empty file; incomplete run: $RUN_DIR" >&2
  exit 1
fi

if command -v shasum >/dev/null 2>&1; then
  (cd "$RUN_DIR" && shasum -a 256 phishingtutor.dump source-roles.sql) > "$RUN_DIR/SHA256SUMS"
elif command -v sha256sum >/dev/null 2>&1; then
  (cd "$RUN_DIR" && sha256sum phishingtutor.dump source-roles.sql) > "$RUN_DIR/SHA256SUMS"
else
  echo "No SHA-256 utility available; incomplete run: $RUN_DIR" >&2
  exit 1
fi

chmod 400 "$RUN_DIR/phishingtutor.dump" "$RUN_DIR/source-roles.sql" "$RUN_DIR/SHA256SUMS"
mv "$RUN_DIR/.incomplete" "$RUN_DIR/.exported"
# Export completion is NOT proof of restore, role, ACL, or migration parity.
echo "Run-scoped export (restore/role parity still required): $RUN_DIR" >&2
printf '%s\n' "$RUN_DIR"

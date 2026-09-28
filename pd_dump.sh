#!/bin/sh
# Export the PhishingTutor application schemas to a private local PostgreSQL dump.
set -eu
SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
DATABASE_DIR="$SCRIPT_DIR/scripts/database"
. "$DATABASE_DIR/pg_dump.sh"

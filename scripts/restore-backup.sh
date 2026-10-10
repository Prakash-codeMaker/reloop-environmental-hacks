#!/usr/bin/env sh
set -eu
if [ "$#" -ne 2 ]; then echo "Usage: $0 <database.sql.gz> <uploads.tar.gz>" >&2; exit 2; fi
DB_BACKUP="$1"; UPLOAD_BACKUP="$2"
[ -f "$DB_BACKUP" ] && [ -f "$UPLOAD_BACKUP" ] || { echo "Backup files not found." >&2; exit 2; }
echo "WARNING: this overwrites the current ReLoop database state and upload files."
printf 'Type RESTORE to continue: '; read CONFIRM
[ "$CONFIRM" = RESTORE ] || { echo "Cancelled."; exit 1; }
gzip -dc "$DB_BACKUP" | docker compose exec -T db sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose exec -T app sh -lc 'rm -rf /app/server/data/uploads/* && mkdir -p /app/server/data/uploads'
docker compose exec -T app tar -xzf - -C /app/server/data < "$UPLOAD_BACKUP"
echo "Restore completed. Verify health and test login/transactions before returning to service."

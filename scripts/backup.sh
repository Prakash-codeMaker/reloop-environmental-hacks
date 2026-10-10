#!/usr/bin/env sh
set -eu
mkdir -p backups
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DB_FILE="backups/reloop-db-${STAMP}.sql.gz"
UPLOAD_FILE="backups/reloop-uploads-${STAMP}.tar.gz"
docker compose exec -T db sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl' | gzip -9 > "$DB_FILE"
docker compose exec -T app tar -czf - -C /app/server/data uploads > "$UPLOAD_FILE"
sha256sum "$DB_FILE" "$UPLOAD_FILE" > "backups/SHA256SUMS-${STAMP}.txt"
echo "Backup complete: $DB_FILE and $UPLOAD_FILE"
echo "Copy encrypted backups off the server and test restoration regularly."

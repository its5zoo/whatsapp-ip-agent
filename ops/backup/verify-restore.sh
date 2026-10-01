#!/usr/bin/env bash
set -Eeuo pipefail

umask 077

: "${BACKUP_ENV_FILE:=/etc/whatsapp-ip-agent/backup.env}"
if [[ ! -r "$BACKUP_ENV_FILE" ]]; then
  echo "Backup environment file is not readable: $BACKUP_ENV_FILE" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$BACKUP_ENV_FILE"
set +a

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY is required}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE is required}"
: "${VERIFY_SNAPSHOT:=latest}"

export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE
if ! command -v docker >/dev/null 2>&1 || ! docker image inspect postgres:16-alpine >/dev/null 2>&1; then
  echo "Required Docker image postgres:16-alpine is not available locally" >&2
  exit 1
fi
if ! command -v restic >/dev/null 2>&1 || ! command -v openssl >/dev/null 2>&1; then
  echo "restic and openssl are required" >&2
  exit 1
fi
if ! command -v tar >/dev/null 2>&1; then
  echo "tar is required" >&2
  exit 1
fi
if ! command -v find >/dev/null 2>&1; then
  echo "find is required" >&2
  exit 1
fi
if ! command -v mapfile >/dev/null 2>&1; then
  echo "A Bash version with mapfile is required" >&2
  exit 1
fi
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/whatsapp-ip-restore-check.XXXXXX")"
container_name="whatsapp-ip-restore-check-$$"
verify_password="$(openssl rand -hex 32)"
cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
  rm -rf "$work_dir"
}
trap cleanup EXIT

restic restore "$VERIFY_SNAPSHOT" --tag whatsapp-ip-agent --target "$work_dir"
mapfile -t manifests < <(find "$work_dir" -type f -name manifest.txt -print)
if [[ "${#manifests[@]}" -ne 1 ]]; then
  echo "Expected exactly one backup manifest in the restored snapshot." >&2
  exit 1
fi
root="$(dirname "${manifests[0]}")"
manifest_value() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { print substr($0, index($0, "=") + 1) }' "$root/manifest.txt"
}

provider="$(manifest_value whatsapp_provider)"
app_database="$(manifest_value app_database)"
n8n_database="$(manifest_value n8n_database)"
evolution_database="$(manifest_value evolution_database)"
for database in "$app_database" "$n8n_database" "$evolution_database"; do
  if [[ -z "$database" || ! "$database" =~ ^[A-Za-z0-9_]+$ ]]; then
    echo "Snapshot manifest contains an invalid database name." >&2
    exit 1
  fi
done

for required_file in manifest.txt globals.sql application.dump n8n.dump n8n_data.tar.gz caddy_data.tar.gz caddy_config.tar.gz; do
  if [[ ! -f "$root/$required_file" ]]; then
    echo "Restored snapshot is missing $required_file" >&2
    exit 1
  fi
done
if [[ "$provider" == "evolution" ]]; then
  for required_file in evolution.dump evolution_redis_data.tar.gz; do
    if [[ ! -f "$root/$required_file" ]]; then
      echo "Evolution snapshot is missing $required_file" >&2
      exit 1
    fi
  done
elif [[ "$provider" != "meta" ]]; then
  echo "Snapshot manifest has an unsupported provider: $provider" >&2
  exit 1
fi

docker run -d --name "$container_name" \
  -e POSTGRES_USER=restore_admin \
  -e POSTGRES_PASSWORD="$verify_password" \
  -e POSTGRES_DB=postgres \
  postgres:16-alpine >/dev/null

ready_timeout=60
ready_elapsed=0
until docker exec "$container_name" pg_isready -U restore_admin >/dev/null 2>&1; do
  if (( ready_elapsed >= ready_timeout )); then
    echo "Timed out waiting for disposable PostgreSQL readiness." >&2
    exit 1
  fi
  sleep 1
  ready_elapsed=$((ready_elapsed + 1))
done

docker cp "$root/globals.sql" "$container_name:/tmp/globals.sql"
docker exec "$container_name" psql -U restore_admin -d postgres -v ON_ERROR_STOP=1 -f /tmp/globals.sql >/dev/null
docker exec "$container_name" createdb -U restore_admin "$app_database"
docker exec "$container_name" createdb -U restore_admin "$n8n_database"
docker cp "$root/application.dump" "$container_name:/tmp/application.dump"
docker cp "$root/n8n.dump" "$container_name:/tmp/n8n.dump"
docker exec "$container_name" pg_restore -U restore_admin --no-owner --no-acl -d "$app_database" /tmp/application.dump
docker exec "$container_name" pg_restore -U restore_admin --no-owner --no-acl -d "$n8n_database" /tmp/n8n.dump

docker exec "$container_name" psql -U restore_admin -d "$app_database" -v ON_ERROR_STOP=1 \
  -c 'SELECT count(*) FROM "conversations";' >/dev/null
docker exec "$container_name" psql -U restore_admin -d "$app_database" -v ON_ERROR_STOP=1 \
  -c 'SELECT count(*) FROM "leads";' >/dev/null

for archive in "$root"/*.tar.gz; do
  [[ -e "$archive" ]] || continue
  tar -tzf "$archive" >/dev/null
  volume_dir="$work_dir/volume-$(basename "$archive" .tar.gz)"
  mkdir "$volume_dir"
  tar -xzf "$archive" --no-same-owner -C "$volume_dir"
  if [[ -z "$(find "$volume_dir" -mindepth 1 -print -quit)" ]]; then
    echo "Persistent volume archive is empty: $archive" >&2
    exit 1
  fi
done

if [[ "$provider" == "evolution" ]]; then
  docker cp "$root/evolution.dump" "$container_name:/tmp/evolution.dump"
  docker exec "$container_name" createdb -U restore_admin "$evolution_database"
  docker exec "$container_name" pg_restore -U restore_admin --no-owner --no-acl -d "$evolution_database" /tmp/evolution.dump
  docker exec "$container_name" psql -U restore_admin -d "$evolution_database" -v ON_ERROR_STOP=1 \
    -c 'SELECT count(*) FROM pg_catalog.pg_tables;' >/dev/null
fi

restic snapshots --tag whatsapp-ip-agent --latest 1 >/dev/null
echo "Disposable PostgreSQL restore, representative queries, and persistent-volume archive verification passed: $VERIFY_SNAPSHOT"

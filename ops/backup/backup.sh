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

: "${PRODUCTION_ENV_FILE:=/etc/whatsapp-ip-agent/production.env}"
: "${COMPOSE_FILE:=docker-compose.prod.yml}"
: "${COMPOSE_PROJECT_DIR:=/opt/whatsapp-ip-agent}"
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY is required}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE is required}"
: "${BACKUP_KEEP_DAILY:=14}"
: "${BACKUP_KEEP_WEEKLY:=8}"
: "${BACKUP_KEEP_MONTHLY:=6}"

cd "$COMPOSE_PROJECT_DIR"
export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE

provider_lines="$(awk -F= '$1 == "WHATSAPP_PROVIDER" { print substr($0, index($0, "=") + 1) }' "$PRODUCTION_ENV_FILE")"
provider_count="$(printf '%s\n' "$provider_lines" | sed '/^$/d' | wc -l | tr -d ' ')"
if [[ "$provider_count" == "0" ]]; then
  if grep -Fq 'WHATSAPP_PROVIDER=${WHATSAPP_PROVIDER:-meta}' "$COMPOSE_FILE"; then
    whatsapp_provider=meta
  else
    echo "WHATSAPP_PROVIDER cannot be determined from $PRODUCTION_ENV_FILE or $COMPOSE_FILE" >&2
    exit 1
  fi
elif [[ "$provider_count" != "1" ]]; then
  echo "WHATSAPP_PROVIDER must be set exactly once in $PRODUCTION_ENV_FILE" >&2
  exit 1
else
  whatsapp_provider="$(printf '%s\n' "$provider_lines" | tr -d '\r')"
fi
case "$whatsapp_provider" in
  meta) include_evolution=false ;;
  evolution) include_evolution=true ;;
  *)
    echo "Unsupported or missing WHATSAPP_PROVIDER: $whatsapp_provider" >&2
    exit 1
    ;;
esac

if ! command -v docker >/dev/null 2>&1 || ! docker image inspect alpine:3.20 >/dev/null 2>&1; then
  echo "Required Docker image alpine:3.20 is not available locally" >&2
  exit 1
fi
if ! command -v restic >/dev/null 2>&1; then
  echo "restic is required" >&2
  exit 1
fi

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/whatsapp-ip-backup.XXXXXX")"
quiesced=false
stopped_n8n=false
stopped_caddy=false
stopped_evolution=false
stopped_redis=false
restart_quiesced_services() {
  [[ "$stopped_n8n" == true ]] && "${compose[@]}" start n8n >/dev/null
  [[ "$stopped_caddy" == true ]] && "${compose[@]}" start caddy >/dev/null
  [[ "$stopped_redis" == true ]] && "${compose[@]}" --profile evolution start evolution-redis >/dev/null
  [[ "$stopped_evolution" == true ]] && "${compose[@]}" --profile evolution start evolution >/dev/null
}
cleanup() {
  if [[ "$quiesced" == true ]]; then
    restart_quiesced_services
  fi
  rm -rf "$work_dir"
}
trap cleanup EXIT

compose=(docker compose --env-file "$PRODUCTION_ENV_FILE" -f "$COMPOSE_FILE")
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
manifest="$work_dir/manifest.txt"

{
  printf 'created_at_utc=%s\n' "$timestamp"
  printf 'compose_file=%s\n' "$COMPOSE_FILE"
  printf 'whatsapp_provider=%s\n' "$whatsapp_provider"
  printf 'git_revision='
  git rev-parse --verify HEAD 2>/dev/null || printf 'unknown'
  printf '\n'
} > "$manifest"

dump_database() {
  local database="$1"
  local output="$2"
  "${compose[@]}" exec -T postgres sh -c \
    'pg_dump --format=custom --no-owner --no-acl -U "$POSTGRES_USER" -d "$1"' \
    sh "$database" > "$output"
}

dump_globals() {
  "${compose[@]}" exec -T postgres sh -c \
    'pg_dumpall --globals-only -U "$POSTGRES_USER"' > "$work_dir/globals.sql"
}

service_running() {
  local service="$1"
  local services
  services="$("${compose[@]}" ps --status running --services)"
  [[ $'\n'"$services"$'\n' == *$'\n'"$service"$'\n'* ]]
}

evolution_service_running() {
  local service="$1"
  local services
  services="$("${compose[@]}" --profile evolution ps --status running --services)"
  [[ $'\n'"$services"$'\n' == *$'\n'"$service"$'\n'* ]]
}

archive_volume() {
  local volume="$1"
  local output="$2"
  docker run --rm \
    -v "${volume}:/source:ro" \
    -v "$work_dir:/backup" \
    alpine:3.20 \
    tar -czf "/backup/$output" -C /source .
}

app_database="${BACKUP_APP_DATABASE:-whatsapp_agent}"
n8n_database="${BACKUP_N8N_DATABASE:-n8n}"
evolution_database="${BACKUP_EVOLUTION_DATABASE:-evolution}"
dump_globals

quiesced=true
if service_running n8n; then
  "${compose[@]}" stop n8n >/dev/null
  stopped_n8n=true
fi
if service_running caddy; then
  "${compose[@]}" stop caddy >/dev/null
  stopped_caddy=true
fi
if [[ "$include_evolution" == true ]]; then
  if evolution_service_running evolution-redis; then
    "${compose[@]}" --profile evolution stop evolution-redis >/dev/null
    stopped_redis=true
  fi
  if evolution_service_running evolution; then
    "${compose[@]}" --profile evolution stop evolution >/dev/null
    stopped_evolution=true
  fi
fi

dump_database "$app_database" "$work_dir/application.dump"
dump_database "$n8n_database" "$work_dir/n8n.dump"
if [[ "$include_evolution" == true ]]; then
  dump_database "$evolution_database" "$work_dir/evolution.dump"
fi

{
  printf 'app_database=%s\n' "$app_database"
  printf 'n8n_database=%s\n' "$n8n_database"
  printf 'evolution_database=%s\n' "$evolution_database"
} >> "$manifest"

archive_volume "${BACKUP_N8N_VOLUME:-${COMPOSE_PROJECT_NAME:-whatsapp-ip-agent-prod}_n8n_data}" "n8n_data.tar.gz"
archive_volume "${BACKUP_CADDY_DATA_VOLUME:-${COMPOSE_PROJECT_NAME:-whatsapp-ip-agent-prod}_caddy_data}" "caddy_data.tar.gz"
archive_volume "${BACKUP_CADDY_CONFIG_VOLUME:-${COMPOSE_PROJECT_NAME:-whatsapp-ip-agent-prod}_caddy_config}" "caddy_config.tar.gz"

if [[ "$include_evolution" == true ]]; then
  archive_volume "${BACKUP_EVOLUTION_REDIS_VOLUME:-${COMPOSE_PROJECT_NAME:-whatsapp-ip-agent-prod}_evolution_redis_data}" "evolution_redis_data.tar.gz"
fi

restart_quiesced_services
quiesced=false

restic backup "$work_dir" --tag whatsapp-ip-agent --tag "$timestamp"
restic check
restic forget \
  --tag whatsapp-ip-agent \
  --keep-daily "$BACKUP_KEEP_DAILY" \
  --keep-weekly "$BACKUP_KEEP_WEEKLY" \
  --keep-monthly "$BACKUP_KEEP_MONTHLY" \
  --prune

echo "Encrypted backup completed: $timestamp"

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
: "${RESTORE_SNAPSHOT:?RESTORE_SNAPSHOT is required}"
: "${RESTORE_TARGET_DIR:?RESTORE_TARGET_DIR is required}"

if [[ "$RESTORE_TARGET_DIR" == "/" || -z "$RESTORE_TARGET_DIR" ]]; then
  echo "Refusing to restore into the filesystem root" >&2
  exit 1
fi

if [[ -e "$RESTORE_TARGET_DIR" || -L "$RESTORE_TARGET_DIR" ]]; then
  echo "Restore target must not already exist: $RESTORE_TARGET_DIR" >&2
  exit 1
fi

export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE

if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  echo "Set CONFIRM_RESTORE=yes to restore snapshot $RESTORE_SNAPSHOT into $RESTORE_TARGET_DIR." >&2
  exit 1
fi

restore_target_created=false
cleanup_partial_restore() {
  local status="$?"
  if [[ "$status" -ne 0 && "$restore_target_created" == true &&
    -d "$RESTORE_TARGET_DIR" && ! -L "$RESTORE_TARGET_DIR" ]]; then
    rm -rf -- "$RESTORE_TARGET_DIR"
  fi
  exit "$status"
}
trap cleanup_partial_restore EXIT

mkdir "$RESTORE_TARGET_DIR"
restore_target_created=true
restic restore "$RESTORE_SNAPSHOT" --target "$RESTORE_TARGET_DIR"
echo "Snapshot restored to $RESTORE_TARGET_DIR."

if [[ "${RESTORE_DATABASES:-no}" == "yes" ]]; then
  if [[ "${CONFIRM_DATABASE_RESTORE:-}" != "yes" ]]; then
    echo "Set CONFIRM_DATABASE_RESTORE=yes to restore PostgreSQL databases." >&2
    exit 1
  fi
  : "${PRODUCTION_ENV_FILE:=/etc/whatsapp-ip-agent/production.env}"
  : "${COMPOSE_FILE:=docker-compose.prod.yml}"
  : "${COMPOSE_PROJECT_DIR:=/opt/whatsapp-ip-agent}"
  cd "$COMPOSE_PROJECT_DIR"
  compose=(docker compose --env-file "$PRODUCTION_ENV_FILE" -f "$COMPOSE_FILE")
  running_services="$("${compose[@]}" ps --status running --services)"
  if [[ $'\n'"$running_services"$'\n' != *$'\npostgres\n'* ]]; then
    echo "The target PostgreSQL service must be running for database restore." >&2
    exit 1
  fi

  mapfile -t manifests < <(find "$RESTORE_TARGET_DIR" -type f -name manifest.txt -print)
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
    if [[ ! "$database" =~ ^[A-Za-z0-9_]+$ ]]; then
      echo "Unsafe database name: $database" >&2
      exit 1
    fi
  done
  if [[ "$provider" != meta && "$provider" != evolution ]]; then
    echo "Snapshot manifest has an unsupported provider: $provider" >&2
    exit 1
  fi
  required_files=(globals.sql application.dump n8n.dump)
  if [[ "$provider" == evolution ]]; then
    required_files+=(evolution.dump)
  fi
  for required_file in "${required_files[@]}"; do
    if [[ ! -f "$root/$required_file" ]]; then
      echo "Restored snapshot is missing $required_file" >&2
      exit 1
    fi
  done

  config_args=()
  if [[ "$provider" == evolution ]]; then
    config_args+=(--profile evolution)
  fi
  compose_services="$("${compose[@]}" "${config_args[@]}" config --services)"
  database_clients=(n8n backend)
  if [[ "$provider" == evolution ]]; then
    database_clients+=(evolution evolution-db-init)
  fi
  for service in "${database_clients[@]}"; do
    if [[ $'\n'"$compose_services"$'\n' == *$'\n'"$service"$'\n'* ]] &&
      [[ $'\n'"$running_services"$'\n' == *$'\n'"$service"$'\n'* ]]; then
      echo "Refusing database restore while dependent service is running: $service" >&2
      exit 1
    fi
  done

  database_state() {
    local database="$1"
    exists="$("${compose[@]}" exec -T postgres sh -c \
      'psql -At -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '\''$1'\''"' \
      sh "$database")"
    if [[ -z "$exists" ]]; then
      printf 'missing\n'
      return
    fi
    tables="$("${compose[@]}" exec -T postgres sh -c \
      'psql -At -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1" -c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('\''r'\'','\''p'\'','\''v'\'','\''m'\'','\''f'\'') AND n.nspname NOT IN ('\''pg_catalog'\'','\''information_schema'\'')"' \
      sh "$database")"
    if [[ "$tables" == 0 ]]; then
      printf 'empty\n'
    else
      printf 'nonempty\n'
    fi
  }
  target_databases=("$app_database" "$n8n_database")
  if [[ "$provider" == evolution ]]; then
    target_databases+=("$evolution_database")
  fi
  for database in "${target_databases[@]}"; do
    state="$(database_state "$database")"
    if [[ "$state" == nonempty ]]; then
      echo "Refusing database restore into non-empty database: $database" >&2
      exit 1
    fi
    if [[ "$state" != missing && "$state" != empty ]]; then
      echo "Could not determine database state for: $database" >&2
      exit 1
    fi
  done

  bootstrap_role="$("${compose[@]}" exec -T postgres sh -c 'printf "%s" "$POSTGRES_USER"')"
  if [[ ! "$bootstrap_role" =~ ^[A-Za-z0-9_]+$ ]]; then
    echo "Unsafe PostgreSQL bootstrap role name." >&2
    exit 1
  fi
  awk -v bootstrap_role="$bootstrap_role" \
    '$0 != "CREATE ROLE " bootstrap_role ";"' \
    "$root/globals.sql" |
    "${compose[@]}" exec -T postgres sh -c \
      'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres'
  restore_database() {
    local database="$1"
    local dump="$2"
    printf "SELECT 'CREATE DATABASE %s' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '%s')\\gexec\n" \
      "$database" "$database" |
      "${compose[@]}" exec -T postgres sh -c \
        'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres'
    "${compose[@]}" exec -T postgres sh -c \
      'pg_restore --no-owner --no-acl -U "$POSTGRES_USER" -d "$1" -' sh "$database" < "$dump"
  }
  restore_database "$app_database" "$root/application.dump"
  restore_database "$n8n_database" "$root/n8n.dump"
  if [[ "$provider" == evolution ]]; then
    restore_database "$evolution_database" "$root/evolution.dump"
  fi
  echo "PostgreSQL globals and databases restored."
else
  echo "Restore globals first, then databases and Docker volumes only after stopping the target stack and verifying the snapshot."
fi

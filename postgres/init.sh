#!/bin/bash
set -e

# Wait for postgres to be ready
until pg_isready -U "$POSTGRES_USER"; do
  sleep 1
done

# Create the n8n database if it doesn't exist.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE n8n'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'n8n')\\gexec
EOSQL

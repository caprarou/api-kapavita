#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

sudo apt-get update
sudo apt-get install -y postgresql postgresql-postgis python3-psycopg
sudo systemctl enable --now postgresql

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='dev'" | grep -q 1; then
  sudo -u postgres createuser dev
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='kapavita'" | grep -q 1; then
  sudo -u postgres createdb --owner=dev kapavita
fi

sudo -u postgres psql --dbname=kapavita --set=ON_ERROR_STOP=1 \
  --command='CREATE EXTENSION IF NOT EXISTS postgis'
psql --dbname=kapavita --set=ON_ERROR_STOP=1 --file="$ROOT/db/migrations/001_core.sql"
python3 "$ROOT/scripts/sync_catalog.py"

echo "KapaVita PostgreSQL/PostGIS database is ready."

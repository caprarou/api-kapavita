#!/usr/bin/env bash
set -euo pipefail
root_dir="/home/dev/projects/kapavita"
secret_dir="/home/dev/.config/kapavita-ais"
if [[ ! -t 0 ]]; then
  printf 'Run this script in an interactive SSH terminal.\n' >&2
  exit 1
fi
umask 077
mkdir -p "$secret_dir"
chmod 700 "$secret_dir"
read -r -s -p 'AISStream API key (input hidden): ' ais_key
printf '\n'
if [[ -z "$ais_key" || "$ais_key" == *$'\n'* ]]; then
  printf 'Missing or invalid key.\n' >&2
  exit 1
fi
printf 'AISSTREAM_API_KEY=%s\n' "$ais_key" > "$secret_dir/ais.env"
chmod 600 "$secret_dir/ais.env"
unset ais_key
sudo install -m 644 "$root_dir/scripts/kapavita-ais.service" /etc/systemd/system/kapavita-ais.service
sudo systemctl daemon-reload
sudo systemctl enable --now kapavita-ais.service
sudo systemctl --no-pager --full status kapavita-ais.service
printf '\nThe first map dot appears only after a real SEAVIOLET AIS message is received.\n'

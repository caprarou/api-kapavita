#!/usr/bin/env bash
set -euo pipefail
repo_dir=/home/dev/projects/kapavita
expected_sha=444b10097c184344db86fd3d0d10de0533f638273e942dcf2783c448d14269b1
actual_sha=$(sha256sum /etc/caddy/Caddyfile | cut -d' ' -f1)
if [[ "$actual_sha" != "$expected_sha" ]] && ! cmp -s /etc/caddy/Caddyfile "$repo_dir/Caddyfile.admin"; then
  printf 'Caddyfile changed since review. Installation stopped to preserve other sites.\n' >&2
  exit 1
fi
install -d -m 700 /home/dev/.local/share/kapavita
sudo install -m 644 "$repo_dir/scripts/kapavita-admin.service" /etc/systemd/system/kapavita-admin.service
sudo install -m 644 "$repo_dir/scripts/kapavita-ais.service" /etc/systemd/system/kapavita-ais.service
sudo systemctl daemon-reload
sudo systemctl enable --now kapavita-admin.service
if systemctl is-active --quiet kapavita-ais.service; then sudo systemctl restart kapavita-ais.service; fi
backup="/etc/caddy/Caddyfile.before-kapavita-admin-$(date +%Y%m%d%H%M%S)"
sudo cp /etc/caddy/Caddyfile "$backup"
sudo install -m 644 "$repo_dir/Caddyfile.admin" /etc/caddy/Caddyfile
if ! sudo caddy validate --config /etc/caddy/Caddyfile; then
  sudo cp "$backup" /etc/caddy/Caddyfile
  printf 'Invalid Caddy configuration; restored %s\n' "$backup" >&2
  exit 1
fi
if ! sudo systemctl reload caddy; then
  sudo cp "$backup" /etc/caddy/Caddyfile
  sudo systemctl reload caddy || true
  printf 'Caddy reload failed; restored previous configuration.\n' >&2
  exit 1
fi
printf '\nService installed. Create the administrator with a private password in this terminal:\n'
printf 'python3 %s/scripts/admin_api.py bootstrap\n' "$repo_dir"
printf 'Admin page: https://api.kapavita.gr/ (Διαχείριση)\n'

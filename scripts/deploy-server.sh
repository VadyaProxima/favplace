#!/usr/bin/env bash
set -euo pipefail
root=/opt/favplace
revision=${1:-}
if [[ ! $revision =~ ^[0-9a-f]{40}$ ]]; then
  echo 'Expected a full commit SHA' >&2
  exit 64
fi

exec 9>"$root/deploy.lock"
flock -w 1800 9
archive="$root/incoming/$revision.tar.gz"
test -f "$archive"
release="$root/releases/$revision"
install -d -m 700 "$release" "$root/backups"
tar -xzf "$archive" -C "$release"
test -f "$release/docker-compose.yml"
ln -sfn "$root/.env" "$release/.env"
# Domain, TLS and Telegram routing are managed on the server.
rm -f "$release/Caddyfile"
ln -s "$root/Caddyfile" "$release/Caddyfile"

compose() {
  local directory=$1
  shift
  docker compose --project-name favplace --project-directory "$directory" \
    --env-file "$root/.env" -f "$directory/docker-compose.yml" \
    -f "$root/docker-compose.override.yml" "$@"
}
compose "$release" config --quiet

previous="$root"
if [[ -L $root/current ]]; then previous=$(readlink -f "$root/current"); fi
api_image=$(docker inspect --format '{{.Image}}' favplace-api-1)
web_image=$(docker inspect --format '{{.Image}}' favplace-web-1)
docker image tag "$api_image" favplace-api:rollback
docker image tag "$web_image" favplace-web:rollback
docker exec favplace-db-1 pg_dump -U favplace favplace | gzip > "$root/backups/$revision.sql.gz"

# Build sequentially so a 4 GB VPS has enough memory. Until both builds pass,
# the previous containers continue serving the site.
compose "$release" build api
compose "$release" build web

rollback() {
  local status=$?
  trap - ERR
  echo 'Deployment failed; restoring the previous application images' >&2
  cat > "$root/rollback-images.yml" <<'YAML'
services:
  api:
    image: favplace-api:rollback
  web:
    image: favplace-web:rollback
YAML
  docker compose --project-name favplace --project-directory "$previous" \
    --env-file "$root/.env" -f "$previous/docker-compose.yml" \
    -f "$root/docker-compose.override.yml" -f "$root/rollback-images.yml" \
    up -d --no-build api web || true
  echo 'A database backup was saved before migration; schema rollback is manual.' >&2
  exit "$status"
}
trap rollback ERR
compose "$release" up -d --no-build api web

ready=false
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 10 \
       https://favplace.178.212.15.39.sslip.io/api/admin/session >/dev/null \
     && curl --fail --silent --show-error --max-time 10 \
       https://favplace.178.212.15.39.sslip.io/ >/dev/null; then
    ready=true
    break
  fi
  sleep 2
done
test "$ready" = true
trap - ERR
ln -sfn "$release" "$root/current"
printf '%s\n' "$revision" > "$root/deployed-sha"
rm -f "$archive"
docker image prune -f
docker buildx prune --all --force --max-used-space 2GB
compose "$release" ps
echo "Deployed $revision"

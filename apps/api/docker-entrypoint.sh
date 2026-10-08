#!/bin/sh
set -e

# Накатываем миграции до старта приложения. migrate deploy идемпотентен:
# уже применённые миграции пропускаются, поэтому это безопасно на каждом рестарте.
echo "==> prisma migrate deploy"
node_modules/.bin/prisma migrate deploy

echo "==> starting API"
exec node dist/main

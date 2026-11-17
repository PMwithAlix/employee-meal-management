#!/bin/sh
set -eu

FAILED_LIVE_MENU_MIGRATION=20261116220000_live_monthly_menu

echo Applying Prisma migrations...
if ! npx prisma migrate deploy; then
  echo "Prisma migrate deploy failed. If ${FAILED_LIVE_MENU_MIGRATION} is marked failed and never applied, mark it rolled back and retry."
  npx prisma migrate resolve --rolled-back "${FAILED_LIVE_MENU_MIGRATION}"
  npx prisma migrate deploy
fi

echo Starting Khaan API...
exec node dist/main.js

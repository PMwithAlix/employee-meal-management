#!/bin/sh
set -eu

echo Applying Prisma migrations...
npx prisma migrate deploy

echo Starting Khaan API...
exec node dist/main.js

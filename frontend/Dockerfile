# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app

ARG VITE_API_BASE_URL=
ARG VITE_BALE_MINI_APP_ENABLED=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_BALE_MINI_APP_ENABLED=$VITE_BALE_MINI_APP_ENABLED

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json postcss.config.js tailwind.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM nginx:1.27-alpine AS runtime
RUN apk add --no-cache wget
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-api-proxy.inc /etc/nginx/khaan-api-proxy.inc
# `backend` is a Compose DNS name and /etc/hosts is read-only during build.
# Syntax-check a copy whose upstream is 127.0.0.1. The shipped files are not modified.
RUN cp /etc/nginx/nginx.conf /tmp/nginx-test.conf \
    && cp /etc/nginx/conf.d/default.conf /tmp/default.conf \
    && cp /etc/nginx/khaan-api-proxy.inc /tmp/khaan-api-proxy.inc \
    && sed -i 's#http://backend:3000#http://127.0.0.1:3000#' /tmp/khaan-api-proxy.inc \
    && sed -i 's#include /etc/nginx/khaan-api-proxy.inc;#include /tmp/khaan-api-proxy.inc;#' /tmp/default.conf \
    && sed -i 's#include /etc/nginx/conf.d/\*\.conf;#include /tmp/default.conf;#' /tmp/nginx-test.conf \
    && grep -q 'include /tmp/default.conf;' /tmp/nginx-test.conf \
    && grep -q 'include /tmp/khaan-api-proxy.inc;' /tmp/default.conf \
    && grep -q 'proxy_pass http://127.0.0.1:3000;' /tmp/khaan-api-proxy.inc \
    && nginx -t -c /tmp/nginx-test.conf \
    && grep -q 'proxy_pass http://backend:3000;' /etc/nginx/khaan-api-proxy.inc \
    && if grep -q '127.0.0.1' /etc/nginx/khaan-api-proxy.inc /etc/nginx/conf.d/default.conf; then exit 1; fi \
    && rm -f /tmp/nginx-test.conf /tmp/default.conf /tmp/khaan-api-proxy.inc
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1

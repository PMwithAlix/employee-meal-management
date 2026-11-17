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
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1

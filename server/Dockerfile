FROM node:20-slim AS base

ENV NODE_ENV=production
WORKDIR /app

# Install server dependencies first for better layer caching.
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# Shared language config is read from repo root by server/src/lib/language.js
COPY i18n.languages.json ./i18n.languages.json

# Copy server source.
COPY server/src ./server/src
COPY server/openapi.yaml ./server/openapi.yaml

EXPOSE 3000
CMD ["node", "server/src/app.js"]


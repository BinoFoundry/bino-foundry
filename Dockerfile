# Bino Foundry API — production image (vendor-neutral)
# Build: docker build -t bino-foundry-api .
# Run:   docker run --env-file .env -p 5050:5050 bino-foundry-api

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY shared/package.json shared/
COPY frontend/package.json frontend/

RUN npm ci

COPY shared/ shared/
COPY backend/ backend/

RUN npm run build -w @bino-foundry/shared && npm run build -w @bino-foundry/backend

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV APP_ENV=production

RUN addgroup -S bino && adduser -S bino -G bino

COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY shared/package.json shared/

RUN npm ci --omit=dev --workspace @bino-foundry/backend --include-workspace-root && npm cache clean --force

COPY --from=builder /app/shared/dist shared/dist
COPY --from=builder /app/shared/package.json shared/package.json
COPY --from=builder /app/backend/dist backend/dist

USER bino
EXPOSE 5050
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5050/api/health || exit 1

WORKDIR /app/backend
CMD ["node", "dist/server.js"]

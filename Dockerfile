# ==============================================================================
# Stage 1: Build Frontend (Vite + React) e Backend (esbuild)
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Compila SPA React in /app/dist e bundle del server Express/WebSocket in /app/dist-server/server.js
RUN npm run build && \
    npx esbuild server.ts --bundle --platform=node --packages=external --format=esm --outfile=dist-server/server.js

# ==============================================================================
# Stage 2: Runtime Alpine Linux ultra-leggero
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/status >/dev/null 2>&1 || exit 1

CMD ["node", "dist-server/server.js"]

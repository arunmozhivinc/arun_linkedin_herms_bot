# ==========================================
# Stage 1: Build NestJS TypeScript Artifacts
# ==========================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package*.json tsconfig.json nest-cli.json ./
RUN npm ci

COPY src ./src
RUN npm run build

# ==========================================
# Stage 2: Production Container with MongoDB
# ==========================================
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install curl, ca-certificates, gnupg and MongoDB Community Server tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg ca-certificates procps \
    && curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg \
    && echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list \
    && apt-get update && apt-get install -y --no-install-recommends mongodb-org-server \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Persistent database and image directories
RUN mkdir -p /data/db /var/log/mongodb /app/data/images

EXPOSE 3000

ENTRYPOINT ["/bin/sh", "./docker-entrypoint.sh"]


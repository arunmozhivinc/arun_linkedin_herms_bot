# Multi-stage Dockerfile for NestJS Enterprise LinkedIn Platform
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json nest-cli.json ./
RUN npm ci

COPY src ./src
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

# Persistent data directory
RUN mkdir -p /app/data/images

EXPOSE 3000

CMD ["node", "dist/main.js"]


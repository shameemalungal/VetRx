# ==============================================================================
# VetRx Backend Production Multi-Stage Dockerfile
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Compile TypeScript
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install build essentials for native dependencies if needed
RUN apk add --no-cache openssl libc6-compat

# Copy package manifests and Prisma schema + migrations
COPY server/package.json server/package-lock.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy server source and configuration
COPY server/tsconfig.json ./
COPY server/src ./src

# Generate Prisma Client with PostgreSQL engine
RUN npx prisma generate --schema=./prisma/schema.prisma

# Compile TypeScript to JavaScript (outDir: dist)
RUN npm run build

# Remove development dependencies to keep final layer lean
RUN npm prune --production

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

# Install runtime dependencies (OpenSSL for Prisma engine)
RUN apk add --no-cache openssl wget libc6-compat

# Create application user and group for security
USER node

# Copy production node_modules from builder
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node --from=builder /app/package.json ./package.json

EXPOSE 4000

# Health Check against /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

# Start compiled backend
CMD ["node", "dist/index.js"]

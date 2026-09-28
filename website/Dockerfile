# ==============================================================================
# VetRx Public Marketing Website Production Multi-Stage Dockerfile
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Static Assets
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY website/package.json ./

# Install dependencies
RUN npm install

# Copy website source code and configs
COPY website/ ./

# Compile TypeScript and bundle with Vite
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Serve with NGINX Alpine
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

# Remove default nginx site
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom NGINX configuration
COPY website/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]

# Stage 1: Build static site
FROM node:22-alpine AS builder

WORKDIR /build

# Copy root package files for TypeDoc
COPY package.json package-lock.json tsconfig.json typedoc.json ./
COPY src/ src/

# Install root deps (for TypeDoc)
RUN npm ci --ignore-scripts

# Generate API docs
RUN npx typedoc

# Copy docs-site
COPY docs-site/ docs-site/
COPY docs/ docs/

# Install docs-site deps and build
WORKDIR /build/docs-site
RUN npm ci
RUN node scripts/sync-api-docs.mjs && npx astro build

# Stage 2: Serve with Nginx
FROM nginx:1.27-alpine

COPY docs-site/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /build/docs-site/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/ || exit 1

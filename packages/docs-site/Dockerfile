# Stage 1: Build static site
FROM node:22-alpine AS builder

WORKDIR /build

# Copy workspace root manifest and lock file
COPY package.json package-lock.json tsconfig.json ./

# Copy SDK package for TypeDoc
COPY packages/sdk/package.json packages/sdk/
COPY packages/sdk/tsconfig.json packages/sdk/
COPY packages/sdk/typedoc.json packages/sdk/
COPY packages/sdk/src/ packages/sdk/src/
COPY packages/sdk/docs/ packages/sdk/docs/

# Copy docs-site package
COPY packages/docs-site/package.json packages/docs-site/

# Stub demo package.json so npm ci resolves workspaces
COPY packages/demo/package.json packages/demo/

# Install all workspace deps
RUN npm ci --ignore-scripts

# Generate API docs via TypeDoc
WORKDIR /build/packages/sdk
RUN npx typedoc

# Copy docs-site source (after install to avoid cache invalidation)
WORKDIR /build
COPY packages/docs-site/ packages/docs-site/

# Sync API docs and build Starlight site
WORKDIR /build/packages/docs-site
RUN node scripts/sync-api-docs.mjs && npx astro build

# Stage 2: Serve with Nginx
FROM nginx:1.27-alpine

COPY packages/docs-site/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /build/packages/docs-site/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1/ || exit 1

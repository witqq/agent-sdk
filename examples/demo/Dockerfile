# Stage 1: Build SDK
FROM node:22-slim AS sdk-builder
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
WORKDIR /sdk
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsup.config.ts ./
COPY src/ src/
RUN npm run build

# Stage 2: Build frontend
FROM node:22-slim AS frontend-builder
# Place frontend so file:../../.. resolves to /sdk
WORKDIR /sdk/examples/demo/frontend
COPY --from=sdk-builder /sdk/package.json /sdk/package.json
COPY --from=sdk-builder /sdk/dist/ /sdk/dist/
COPY --from=sdk-builder /sdk/src/ /sdk/src/
COPY examples/demo/frontend/package.json ./
RUN npm install --ignore-scripts
COPY examples/demo/frontend/ ./
RUN npx vite build

# Stage 3: Runtime
FROM node:22-slim
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*
WORKDIR /sdk

# Copy full SDK (with node_modules for runtime deps)
COPY --from=sdk-builder /sdk/ /sdk/

# Copy built frontend
COPY --from=frontend-builder /sdk/examples/demo/frontend/dist/ /sdk/examples/demo/frontend/dist/

# Copy server
COPY examples/demo/server.ts /sdk/examples/demo/server.ts
COPY examples/demo/model-allowlist.ts /sdk/examples/demo/model-allowlist.ts

# Install tsx and Copilot CLI globally (CLI binary needed for copilot backend)
RUN npm install -g tsx @github/copilot

ENV PORT=3456
ENV TOKEN_DIR=/data
ENV NODE_ENV=production
EXPOSE 3456

VOLUME ["/data"]

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -sf -X POST -H "Content-Type: application/json" -d '{}' http://localhost:3456/api/health || exit 1

CMD ["tsx", "/sdk/examples/demo/server.ts"]

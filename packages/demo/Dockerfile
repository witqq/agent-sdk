# Stage 1: Build SDK
FROM node:24.20.0-bookworm-slim AS sdk-builder
RUN apt-get update && apt-get install -y git python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install --global npm@12.0.2
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/sdk/package.json packages/sdk/
COPY packages/demo/package.json packages/demo/
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY packages/sdk/tsconfig.json packages/sdk/
COPY packages/sdk/tsdown.config.ts packages/sdk/
COPY packages/sdk/src/ packages/sdk/src/
RUN npm run build -w packages/sdk

# Stage 2: Build frontend
FROM node:24.20.0-bookworm-slim AS frontend-builder
# Frontend resolves @witqq/agent-sdk via file:../../sdk
RUN npm install --global npm@12.0.2
WORKDIR /app/packages/demo/frontend
COPY --from=sdk-builder /app/packages/sdk/package.json /app/packages/sdk/package.json
COPY --from=sdk-builder /app/packages/sdk/dist/ /app/packages/sdk/dist/
COPY --from=sdk-builder /app/packages/sdk/src/ /app/packages/sdk/src/
COPY packages/demo/frontend/package.json packages/demo/frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY packages/demo/frontend/ ./
RUN npx vite build

# Stage 3: Runtime
FROM node:24.20.0-bookworm-slim
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*
RUN npm install --global npm@12.0.2
WORKDIR /app

# Copy full workspace with SDK (node_modules for runtime deps)
COPY --from=sdk-builder /app/ /app/

# Copy built frontend
COPY --from=frontend-builder /app/packages/demo/frontend/dist/ /app/packages/demo/frontend/dist/

# Copy demo server files
COPY packages/demo/server.ts packages/demo/
COPY packages/demo/server-mock.ts packages/demo/
COPY packages/demo/model-allowlist.ts packages/demo/
COPY packages/demo/tools.ts packages/demo/

# Install the Copilot CLI globally (CLI binary needed for copilot backend).
# tsx is a locked runtime dependency of the demo workspace and was installed
# with the repository's exact allowScripts policy in the sdk-builder stage.
RUN npm install --global @github/copilot@1.0.83

ENV PORT=3456
ENV DB_PATH=/data/chat.db
ENV NODE_ENV=production
EXPOSE 3456

VOLUME ["/data"]

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -sf http://localhost:3456/api/health || exit 1

CMD ["/app/node_modules/.bin/tsx", "/app/packages/demo/server.ts"]

FROM node:22-slim

WORKDIR /app

# Install git (needed for some npm packages)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Copy package files first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY tsconfig.json tsup.config.ts ./
COPY src/ src/
RUN npm run build

# Copy demo
COPY examples/auth-demo/ examples/auth-demo/

VOLUME /data
EXPOSE 3456

# Web server mode by default, override with CLI_MODE=1 for terminal
CMD ["npx", "tsx", "examples/auth-demo/server.ts"]

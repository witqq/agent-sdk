FROM node:22-slim

WORKDIR /app

# Install dependencies for both SDKs
RUN npm init -y && \
    npm install @github/copilot-sdk@latest @anthropic-ai/claude-agent-sdk@latest

# Copy test scripts
COPY scripts/ /app/scripts/

# Default command
CMD ["node", "--version"]

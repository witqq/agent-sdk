#!/usr/bin/env bash
# Start agent-sdk auth demo in Docker
cd "$(dirname "$0")" && docker compose up -d --build && echo -e "\nOpen http://localhost:3456"

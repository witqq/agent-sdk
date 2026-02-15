#!/usr/bin/env bash
# Show agent-sdk auth demo logs
docker logs agent-sdk-demo -f --tail "${1:-50}"

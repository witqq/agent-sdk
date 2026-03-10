---
title: "C4 Level 1: Context Diagram"
project: "@witqq/agent-sdk"
---

# Context Diagram (C4 Level 1)

```mermaid
graph TB
    Dev["SDK Consumer<br/>(Developer)"]
    Browser["End User<br/>(Browser)"]
    SDK["@witqq/agent-sdk<br/>TypeScript npm package"]
    CopilotCLI["GitHub Copilot CLI<br/>(subprocess)"]
    ClaudeCLI["Claude CLI<br/>(subprocess)"]
    VercelAPI["Vercel AI SDK v6<br/>(HTTP API)"]
    GitHub["GitHub OAuth<br/>(Device Flow)"]
    Anthropic["Anthropic OAuth<br/>(PKCE)"]
    SQLiteDB[("SQLite<br/>(optional)")]

    Dev -->|"imports npm package"| SDK
    Browser -->|"HTTP/SSE"| SDK
    SDK -->|"spawns subprocess"| CopilotCLI
    SDK -->|"spawns subprocess"| ClaudeCLI
    SDK -->|"HTTP (generateText/streamText)"| VercelAPI
    SDK -->|"Device Flow"| GitHub
    SDK -->|"OAuth + PKCE"| Anthropic
    SDK -->|"better-sqlite3"| SQLiteDB
```

## External Systems

| System | Protocol | Purpose |
|--------|----------|---------|
| GitHub Copilot CLI | subprocess (stdio) | Agent execution with GitHub auth |
| Claude CLI | subprocess (stdio) | Agent execution with Anthropic auth |
| Vercel AI SDK v6 | HTTP (OpenAI-compatible) | Agent execution with API key |
| GitHub OAuth | HTTPS (Device Flow) | Copilot authentication |
| Anthropic OAuth | HTTPS (Authorization Code + PKCE) | Claude authentication |
| SQLite | better-sqlite3 (file) | Session, provider, token storage |

# Framework Presets

Adapter examples for integrating agent-sdk server handlers with popular HTTP frameworks.

## Available Adapters

### Express (`express-adapter.ts`)

Express req/res objects are natively compatible with the SDK's interfaces.
The adapter wraps the handler promise to forward errors via `next()`.

```ts
import express from "express";
import { createChatHandler, createAuthHandler } from "@witqq/agent-sdk/chat/server";
import { toExpressMiddleware } from "./express-adapter";

const app = express();
app.use("/api/chat", toExpressMiddleware(createChatHandler(runtime)));
app.use("/api/auth", toExpressMiddleware(createAuthHandler(authOptions)));
app.listen(3000);
```

### Hono (`hono-adapter.ts`)

Hono uses web-standard Request/Response. The adapter bridges Hono's Context
to the SDK's node:http-style interfaces, handling both JSON and SSE responses.

```ts
import { Hono } from "hono";
import { createChatHandler } from "@witqq/agent-sdk/chat/server";
import { honoHandler } from "./hono-adapter";

const app = new Hono();
app.all("/api/chat/*", honoHandler(createChatHandler(runtime)));
export default app;
```

### Fastify (`fastify-adapter.ts`)

Fastify wraps node:http request/response. The adapter uses `reply.hijack()`
to bypass Fastify's serialization and write directly to the raw response.

```ts
import Fastify from "fastify";
import { createChatHandler } from "@witqq/agent-sdk/chat/server";
import { registerRoutes } from "./fastify-adapter";

const app = Fastify();
registerRoutes(app, createChatHandler(runtime), "/api/chat");
app.listen({ port: 3000 });
```

## Architecture

All adapters follow the same pattern:

1. Accept an SDK `RequestHandler` (from `createChatHandler`, `createAuthHandler`, or `createChatServer`)
2. Adapt the framework's request object to `ReadableRequest`
3. Adapt the framework's response object to `WritableResponse`
4. Forward to the SDK handler

The SDK handlers are framework-agnostic by design — these adapters are thin
wrappers that handle the interface differences.

# Custom Transport Examples

Demonstrates how to implement custom `IChatTransport` for non-HTTP communication.

The SDK's `IChatTransport` interface is intentionally minimal:

```typescript
interface IChatTransport {
  send(event: ChatEvent): void;
  close(): void;
  error(err: Error): void;
  readonly isOpen: boolean;
}
```

Any communication channel that can send JSON objects can implement this interface.

## Examples

### 1. WebSocket Transport (`ws-transport.ts`)

Server-side transport that sends `ChatEvent` objects over a WebSocket connection.
Use case: Real-time bidirectional chat (e.g., collaborative editing, live dashboards).

### 2. In-Process Transport (`in-process-transport.ts`)

Transport for same-process communication without network overhead.
Use case: Desktop apps (Electron), CLI tools, test environments.

### 3. NATS Transport (`nats-transport.ts`)

Transport that publishes `ChatEvent` to a NATS subject.
Use case: Microservice architectures, event-driven systems (e.g., claude-supervisor).

### 4. Enhanced NATS Transport (`nats-enhanced-transport.ts`)

Subject-based routing with request-reply and pub/sub streaming patterns.
Includes `NatsChatRouter` (server-side) and `NatsChatClient` (client-side) with typed methods for send, sessions, and models.

## Usage Pattern

All transports follow the same pattern with `streamToTransport()`:

```typescript
import { streamToTransport } from '@witqq/agent-sdk/chat/backends';

// 1. Create your transport
const transport = new WsChatTransport(wsConnection);

// 2. Get a ChatEvent stream from runtime
const stream = runtime.send(sessionId, message, { model: 'gpt-5-mini', backend: 'copilot' });

// 3. Pipe stream to transport
await streamToTransport(stream, transport);
```

Or use directly with `createChatHandler`-style routing:

```typescript
// In your custom handler
const transport = new NatsChatTransport(nats, replySubject);
const stream = runtime.send(sessionId, message, { model: 'gpt-5-mini', backend: 'copilot' });
await streamToTransport(stream, transport);
```

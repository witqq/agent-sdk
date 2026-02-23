# Custom Transports

The SDK ships three transport implementations and an interface for building your own.

## Built-in Transports

### SSEChatTransport

Server-Sent Events over HTTP. The default for web applications.

```ts
import { SSEChatTransport, streamToTransport } from "@witqq/agent-sdk/chat/backends";

// In an HTTP handler:
const transport = new SSEChatTransport(res, {
  heartbeatMs: 15000,
  request: req, // close detection
});

await streamToTransport(adapter.streamMessage(session, content), transport);
```

### WsChatTransport

WebSocket transport. Works with any WebSocket-like object (`ws`, browser WebSocket, Deno, Bun).

```ts
import { WsChatTransport, streamToTransport } from "@witqq/agent-sdk/chat/backends";

wss.on("connection", (ws) => {
  ws.on("message", async (data) => {
    const { sessionId, content } = JSON.parse(data.toString());

    const transport = new WsChatTransport(ws, {
      heartbeatMs: 30000,
    });

    await streamToTransport(adapter.streamMessage(session, content), transport);
  });
});
```

Options:
- `heartbeatMs` — periodic ping interval (sends `{ type: "heartbeat" }`)
- `serialize` — custom event serializer (defaults to `JSON.stringify`)

### InProcessChatTransport

Zero-network transport using async iteration. Events are pushed by the producer and consumed by the reader.

```ts
import { InProcessChatTransport, streamToTransport } from "@witqq/agent-sdk/chat/backends";

const transport = new InProcessChatTransport();

// Consumer (reads events as async iterable)
const events: ChatEvent[] = [];
const reading = (async () => {
  for await (const event of transport) {
    events.push(event);
  }
})();

// Producer (pipes adapter output into transport)
await streamToTransport(adapter.streamMessage(session, content), transport);
await reading;
```

Use cases: unit testing, CLI tools, embedded runtimes, in-process pipelines.

## IChatTransport Interface

All transports implement this interface:

```ts
interface IChatTransport {
  send(event: ChatEvent): void;  // deliver an event
  close(): void;                 // signal completion
  error(err: Error): void;       // signal error
  readonly isOpen: boolean;      // connection status
}
```

## Building a Custom Transport

Implement `IChatTransport` and handle the full lifecycle:

```ts
import type { IChatTransport } from "@witqq/agent-sdk/chat/backends";
import type { ChatEvent } from "@witqq/agent-sdk/chat/core";

class MyTransport implements IChatTransport {
  private _open = true;

  get isOpen() { return this._open; }

  send(event: ChatEvent): void {
    if (!this.isOpen) return;
    // Deliver event to your protocol
  }

  close(): void {
    if (!this.isOpen) return;
    this._open = false;
    // Signal completion to your protocol
  }

  error(err: Error): void {
    if (!this.isOpen) return;
    this._open = false;
    // Deliver error event, then close
  }
}
```

Key requirements:
1. `send()` must be silent (no-op) when `isOpen` is false
2. `close()` and `error()` must be idempotent (safe to call multiple times)
3. `error()` should send an error ChatEvent before closing
4. Clean up timers/listeners in close paths

## streamToTransport Helper

Pipes any `AsyncIterable<ChatEvent>` into any transport:

```ts
import { streamToTransport } from "@witqq/agent-sdk/chat/backends";

await streamToTransport(eventSource, transport);
// Transport is closed after iteration completes (or errored on exception)
```

This works with all three built-in transports and any custom implementation.

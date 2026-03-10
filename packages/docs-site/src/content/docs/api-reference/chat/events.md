---
title: "Chat Events"
description: "Chat event types for streaming"
sidebar:
  order: 23
---
# chat/events

## Classes

### ChatEventBus

Defined in: [chat/events.ts:222](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L222)

Chat event bus: a typed event emitter specialized for ChatEvent types
with middleware pipeline support.

Events pass through the middleware pipeline before reaching listeners.
Middleware can inspect, transform, or suppress events.

#### Example

```typescript
const bus = new ChatEventBus();

// Add middleware
bus.use((ctx) => {
  console.log(`[${ctx.event.type}]`);
  ctx.next();
});

// Listen for events
bus.on("message:delta", (event) => {
  console.log(event.text);
});

// Emit events
bus.emit("message:delta", { type: "message:delta", messageId: id, text: "hi" });
```

#### Extends

- [`TypedEventEmitter`](#typedeventemitter)\<[`ChatEventMap`](#chateventmap)\>

#### Constructors

##### Constructor

> **new ChatEventBus**(): [`ChatEventBus`](#chateventbus)

###### Returns

[`ChatEventBus`](#chateventbus)

###### Inherited from

[`TypedEventEmitter`](#typedeventemitter).[`constructor`](#constructor-1)

#### Methods

##### clearMiddleware()

> **clearMiddleware**(): `void`

Defined in: [chat/events.ts:296](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L296)

Remove all middleware functions.

###### Returns

`void`

##### emit()

> **emit**\<`K`\>(`event`, `payload`): `void`

Defined in: [chat/events.ts:246](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L246)

Emit a chat event through the middleware pipeline, then to listeners.

###### Type Parameters

###### K

`K` *extends* `"heartbeat"` \| `"error"` \| `"done"` \| `"usage"` \| `"message:start"` \| `"message:delta"` \| `"message:complete"` \| `"tool:start"` \| `"tool:complete"` \| `"thinking:start"` \| `"thinking:delta"` \| `"thinking:end"` \| `"permission:request"` \| `"permission:response"` \| `"session:created"` \| `"session:updated"` \| `"typing:start"` \| `"typing:end"`

###### Parameters

###### event

`K`

ChatEvent type string

###### payload

[`ChatEventMap`](#chateventmap)\[`K`\]

The full ChatEvent object

###### Returns

`void`

###### Overrides

[`TypedEventEmitter`](#typedeventemitter).[`emit`](#emit-1)

##### eventNames()

> **eventNames**(): (`"heartbeat"` \| `"error"` \| `"done"` \| `"usage"` \| `"message:start"` \| `"message:delta"` \| `"message:complete"` \| `"tool:start"` \| `"tool:complete"` \| `"thinking:start"` \| `"thinking:delta"` \| `"thinking:end"` \| `"permission:request"` \| `"permission:response"` \| `"session:created"` \| `"session:updated"` \| `"typing:start"` \| `"typing:end"`)[]

Defined in: [chat/events.ts:138](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L138)

Get all event names that have at least one listener.

###### Returns

(`"heartbeat"` \| `"error"` \| `"done"` \| `"usage"` \| `"message:start"` \| `"message:delta"` \| `"message:complete"` \| `"tool:start"` \| `"tool:complete"` \| `"thinking:start"` \| `"thinking:delta"` \| `"thinking:end"` \| `"permission:request"` \| `"permission:response"` \| `"session:created"` \| `"session:updated"` \| `"typing:start"` \| `"typing:end"`)[]

Array of event names

###### Inherited from

[`TypedEventEmitter`](#typedeventemitter).[`eventNames`](#eventnames-1)

##### listenerCount()

> **listenerCount**\<`K`\>(`event`): `number`

Defined in: [chat/events.ts:129](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L129)

Get the number of listeners for a specific event.

###### Type Parameters

###### K

`K` *extends* `"heartbeat"` \| `"error"` \| `"done"` \| `"usage"` \| `"message:start"` \| `"message:delta"` \| `"message:complete"` \| `"tool:start"` \| `"tool:complete"` \| `"thinking:start"` \| `"thinking:delta"` \| `"thinking:end"` \| `"permission:request"` \| `"permission:response"` \| `"session:created"` \| `"session:updated"` \| `"typing:start"` \| `"typing:end"`

###### Parameters

###### event

`K`

Event name

###### Returns

`number`

Number of listeners

###### Inherited from

[`TypedEventEmitter`](#typedeventemitter).[`listenerCount`](#listenercount-1)

##### middlewareCount()

> **middlewareCount**(): `number`

Defined in: [chat/events.ts:304](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L304)

Get the number of registered middleware functions.

###### Returns

`number`

Number of middleware

##### off()

> **off**\<`K`\>(`event`, `listener`): `void`

Defined in: [chat/events.ts:90](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L90)

Remove a specific listener from an event.

###### Type Parameters

###### K

`K` *extends* `"heartbeat"` \| `"error"` \| `"done"` \| `"usage"` \| `"message:start"` \| `"message:delta"` \| `"message:complete"` \| `"tool:start"` \| `"tool:complete"` \| `"thinking:start"` \| `"thinking:delta"` \| `"thinking:end"` \| `"permission:request"` \| `"permission:response"` \| `"session:created"` \| `"session:updated"` \| `"typing:start"` \| `"typing:end"`

###### Parameters

###### event

`K`

Event name

###### listener

[`Listener`](#listener)\<[`ChatEventMap`](#chateventmap)\[`K`\]\>

The listener to remove

###### Returns

`void`

###### Inherited from

[`TypedEventEmitter`](#typedeventemitter).[`off`](#off-1)

##### on()

> **on**\<`K`\>(`event`, `listener`): [`Unsubscribe`](#unsubscribe)

Defined in: [chat/events.ts:55](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L55)

Subscribe to an event.

###### Type Parameters

###### K

`K` *extends* `"heartbeat"` \| `"error"` \| `"done"` \| `"usage"` \| `"message:start"` \| `"message:delta"` \| `"message:complete"` \| `"tool:start"` \| `"tool:complete"` \| `"thinking:start"` \| `"thinking:delta"` \| `"thinking:end"` \| `"permission:request"` \| `"permission:response"` \| `"session:created"` \| `"session:updated"` \| `"typing:start"` \| `"typing:end"`

###### Parameters

###### event

`K`

Event name

###### listener

[`Listener`](#listener)\<[`ChatEventMap`](#chateventmap)\[`K`\]\>

Callback receiving the event payload

###### Returns

[`Unsubscribe`](#unsubscribe)

Unsubscribe function

###### Inherited from

[`TypedEventEmitter`](#typedeventemitter).[`on`](#on-1)

##### once()

> **once**\<`K`\>(`event`, `listener`): [`Unsubscribe`](#unsubscribe)

Defined in: [chat/events.ts:77](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L77)

Subscribe to an event, firing the listener at most once.

###### Type Parameters

###### K

`K` *extends* `"heartbeat"` \| `"error"` \| `"done"` \| `"usage"` \| `"message:start"` \| `"message:delta"` \| `"message:complete"` \| `"tool:start"` \| `"tool:complete"` \| `"thinking:start"` \| `"thinking:delta"` \| `"thinking:end"` \| `"permission:request"` \| `"permission:response"` \| `"session:created"` \| `"session:updated"` \| `"typing:start"` \| `"typing:end"`

###### Parameters

###### event

`K`

Event name

###### listener

[`Listener`](#listener)\<[`ChatEventMap`](#chateventmap)\[`K`\]\>

Callback receiving the event payload

###### Returns

[`Unsubscribe`](#unsubscribe)

Unsubscribe function

###### Inherited from

[`TypedEventEmitter`](#typedeventemitter).[`once`](#once-1)

##### removeAllListeners()

> **removeAllListeners**\<`K`\>(`event?`): `void`

Defined in: [chat/events.ts:116](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L116)

Remove all listeners for a specific event, or all events if no event specified.

###### Type Parameters

###### K

`K` *extends* `"heartbeat"` \| `"error"` \| `"done"` \| `"usage"` \| `"message:start"` \| `"message:delta"` \| `"message:complete"` \| `"tool:start"` \| `"tool:complete"` \| `"thinking:start"` \| `"thinking:delta"` \| `"thinking:end"` \| `"permission:request"` \| `"permission:response"` \| `"session:created"` \| `"session:updated"` \| `"typing:start"` \| `"typing:end"`

###### Parameters

###### event?

`K`

Optional event name

###### Returns

`void`

###### Inherited from

[`TypedEventEmitter`](#typedeventemitter).[`removeAllListeners`](#removealllisteners-1)

##### use()

> **use**(`middleware`): [`Unsubscribe`](#unsubscribe)

Defined in: [chat/events.ts:230](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L230)

Register a middleware function. Middleware runs in registration order.

###### Parameters

###### middleware

[`EventMiddleware`](#eventmiddleware)

Middleware function

###### Returns

[`Unsubscribe`](#unsubscribe)

Unsubscribe function to remove the middleware

***

### TypedEventEmitter

Defined in: [chat/events.ts:46](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L46)

Generic type-safe event emitter parameterized by an EventMap.

#### Example

```typescript
type MyEvents = {
  message: string;
  count: number;
  done: void;
};
const emitter = new TypedEventEmitter<MyEvents>();
emitter.on("message", (text) => console.log(text));
emitter.emit("message", "hello");
```

#### Extended by

- [`ChatEventBus`](#chateventbus)

#### Type Parameters

##### T

`T` *extends* [`EventMap`](#eventmap)

Map of event names to payload types

#### Constructors

##### Constructor

> **new TypedEventEmitter**\<`T`\>(): [`TypedEventEmitter`](#typedeventemitter)\<`T`\>

###### Returns

[`TypedEventEmitter`](#typedeventemitter)\<`T`\>

#### Methods

##### emit()

> **emit**\<`K`\>(`event`, `payload`): `void`

Defined in: [chat/events.ts:104](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L104)

Emit an event, calling all registered listeners synchronously.

###### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

###### Parameters

###### event

`K`

Event name

###### payload

`T`\[`K`\]

Event payload

###### Returns

`void`

##### eventNames()

> **eventNames**(): keyof `T`[]

Defined in: [chat/events.ts:138](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L138)

Get all event names that have at least one listener.

###### Returns

keyof `T`[]

Array of event names

##### listenerCount()

> **listenerCount**\<`K`\>(`event`): `number`

Defined in: [chat/events.ts:129](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L129)

Get the number of listeners for a specific event.

###### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

###### Parameters

###### event

`K`

Event name

###### Returns

`number`

Number of listeners

##### off()

> **off**\<`K`\>(`event`, `listener`): `void`

Defined in: [chat/events.ts:90](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L90)

Remove a specific listener from an event.

###### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

###### Parameters

###### event

`K`

Event name

###### listener

[`Listener`](#listener)\<`T`\[`K`\]\>

The listener to remove

###### Returns

`void`

##### on()

> **on**\<`K`\>(`event`, `listener`): [`Unsubscribe`](#unsubscribe)

Defined in: [chat/events.ts:55](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L55)

Subscribe to an event.

###### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

###### Parameters

###### event

`K`

Event name

###### listener

[`Listener`](#listener)\<`T`\[`K`\]\>

Callback receiving the event payload

###### Returns

[`Unsubscribe`](#unsubscribe)

Unsubscribe function

##### once()

> **once**\<`K`\>(`event`, `listener`): [`Unsubscribe`](#unsubscribe)

Defined in: [chat/events.ts:77](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L77)

Subscribe to an event, firing the listener at most once.

###### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

###### Parameters

###### event

`K`

Event name

###### listener

[`Listener`](#listener)\<`T`\[`K`\]\>

Callback receiving the event payload

###### Returns

[`Unsubscribe`](#unsubscribe)

Unsubscribe function

##### removeAllListeners()

> **removeAllListeners**\<`K`\>(`event?`): `void`

Defined in: [chat/events.ts:116](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L116)

Remove all listeners for a specific event, or all events if no event specified.

###### Type Parameters

###### K

`K` *extends* `string` \| `number` \| `symbol`

###### Parameters

###### event?

`K`

Optional event name

###### Returns

`void`

## Interfaces

### MiddlewareContext

Defined in: [chat/events.ts:159](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L159)

Context passed to middleware functions.
Contains the event and control methods for the middleware pipeline.

#### Properties

##### event

> **event**: [`ChatEvent`](/api-reference/chat/index-exports/#chatevent)

Defined in: [chat/events.ts:161](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L161)

The current event (may be transformed by prior middleware)

##### next()

> **next**: () => `void`

Defined in: [chat/events.ts:163](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L163)

Call the next middleware in the chain, or deliver to listeners if last

###### Returns

`void`

##### suppress()

> **suppress**: () => `void`

Defined in: [chat/events.ts:165](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L165)

Suppress the event — do not deliver to listeners or subsequent middleware

###### Returns

`void`

## Type Aliases

### ChatEventMap

> **ChatEventMap** = `{ [K in ChatEventType]: Extract<ChatEvent, { type: K }> }`

Defined in: [chat/events.ts:149](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L149)

Map of ChatEvent type strings to their corresponding ChatEvent payloads.
Used to parameterize TypedEventEmitter for chat events.

***

### EventMap

> **EventMap** = `Record`\<`string`, `any`\>

Defined in: [chat/events.ts:17](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L17)

Constraint for event maps: keys are strings, values are payloads

***

### EventMiddleware()

> **EventMiddleware** = (`ctx`) => `void`

Defined in: [chat/events.ts:192](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L192)

Middleware function for intercepting, transforming, or suppressing events.
EventMiddleware operates at the ChatEventBus level.

#### Parameters

##### ctx

[`MiddlewareContext`](#middlewarecontext)

Middleware context with event, next(), and suppress()

#### Returns

`void`

#### Example

```typescript
// Logging middleware
const logger: EventMiddleware = (ctx) => {
  console.log(`Event: ${ctx.event.type}`);
  ctx.next();
};

// Suppressing middleware
const filter: EventMiddleware = (ctx) => {
  if (ctx.event.type === "heartbeat") {
    ctx.suppress();
  } else {
    ctx.next();
  }
};
```

***

### Listener()

> **Listener**\<`T`\> = (`payload`) => `void`

Defined in: [chat/events.ts:22](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L22)

Listener callback for a specific event

#### Type Parameters

##### T

`T`

#### Parameters

##### payload

`T`

#### Returns

`void`

***

### Unsubscribe()

> **Unsubscribe** = () => `void`

Defined in: [chat/events.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L25)

Unsubscribe function returned by on/once

#### Returns

`void`

## Functions

### collectText()

> **collectText**(`source`): `Promise`\<`string`\>

Defined in: [chat/events.ts:396](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L396)

Collect text from message:delta events into a single string.

#### Parameters

##### source

`AsyncIterable`\<[`ChatEvent`](/api-reference/chat/index-exports/#chatevent)\>

Async iterable of ChatEvents

#### Returns

`Promise`\<`string`\>

Complete text assembled from message:delta payloads

#### Example

```typescript
const fullText = await collectText(stream);
```

***

### eventFilter()

> **eventFilter**(...`types`): (`event`) => `boolean`

Defined in: [chat/events.ts:323](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L323)

Create a filter function that passes only events of specified types.

#### Parameters

##### types

...(`"heartbeat"` \| `"error"` \| `"done"` \| `"usage"` \| `"message:start"` \| `"message:delta"` \| `"message:complete"` \| `"tool:start"` \| `"tool:complete"` \| `"thinking:start"` \| `"thinking:delta"` \| `"thinking:end"` \| `"permission:request"` \| `"permission:response"` \| `"session:created"` \| `"session:updated"` \| `"typing:start"` \| `"typing:end"`)[]

Event types to allow through

#### Returns

Predicate function for filtering ChatEvents

> (`event`): `boolean`

##### Parameters

###### event

[`ChatEvent`](/api-reference/chat/index-exports/#chatevent)

##### Returns

`boolean`

#### Example

```typescript
const isTextEvent = eventFilter("message:start", "message:delta", "message:complete");
const textEvents = allEvents.filter(isTextEvent);
```

***

### filterEvents()

> **filterEvents**(`source`, ...`types`): `AsyncIterable`\<[`ChatEvent`](/api-reference/chat/index-exports/#chatevent)\>

Defined in: [chat/events.ts:344](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L344)

Filter an async iterable of ChatEvents to only specified types.

#### Parameters

##### source

`AsyncIterable`\<[`ChatEvent`](/api-reference/chat/index-exports/#chatevent)\>

Async iterable of ChatEvents

##### types

...(`"heartbeat"` \| `"error"` \| `"done"` \| `"usage"` \| `"message:start"` \| `"message:delta"` \| `"message:complete"` \| `"tool:start"` \| `"tool:complete"` \| `"thinking:start"` \| `"thinking:delta"` \| `"thinking:end"` \| `"permission:request"` \| `"permission:response"` \| `"session:created"` \| `"session:updated"` \| `"typing:start"` \| `"typing:end"`)[]

Event types to keep

#### Returns

`AsyncIterable`\<[`ChatEvent`](/api-reference/chat/index-exports/#chatevent)\>

Async iterable of filtered ChatEvents

#### Example

```typescript
for await (const event of filterEvents(stream, "message:delta", "message:complete")) {
  // only message:delta and message:complete events
}
```

***

### mapEvents()

> **mapEvents**\<`R`\>(`source`, `transform`): `AsyncIterable`\<`R`\>

Defined in: [chat/events.ts:373](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/events.ts#L373)

Map/transform events from an async iterable.

#### Type Parameters

##### R

`R`

#### Parameters

##### source

`AsyncIterable`\<[`ChatEvent`](/api-reference/chat/index-exports/#chatevent)\>

Async iterable of ChatEvents

##### transform

(`event`) => `R` \| `null`

Function to transform each event (return null to skip)

#### Returns

`AsyncIterable`\<`R`\>

Async iterable of transformed values

#### Example

```typescript
// Extract text from message:delta events
const texts = mapEvents(stream, (event) =>
  event.type === "message:delta" ? event.text : null
);
```

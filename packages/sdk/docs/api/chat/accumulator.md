[**@witqq/agent-sdk**](../README.md)

***

[@witqq/agent-sdk](../README.md) / chat/accumulator

# chat/accumulator

## Classes

### MessageAccumulator

Defined in: [chat/accumulator.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/accumulator.ts#L27)

Converts a stream of AgentEvent objects into a complete ChatMessage.
Tracks text, reasoning, and tool call parts with proper status transitions.

#### Example

```typescript
const acc = new MessageAccumulator();
for await (const event of agentEvents) {
  acc.apply(event);
  renderMessage(acc.snapshot()); // in-progress UI update
}
const message = acc.finalize();
```

#### Constructors

##### Constructor

> **new MessageAccumulator**(`messageId?`): [`MessageAccumulator`](#messageaccumulator)

Defined in: [chat/accumulator.ts:36](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/accumulator.ts#L36)

###### Parameters

###### messageId?

[`ChatId`](../chat.md#chatid)

###### Returns

[`MessageAccumulator`](#messageaccumulator)

#### Accessors

##### finalized

###### Get Signature

> **get** **finalized**(): `boolean`

Defined in: [chat/accumulator.ts:176](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/accumulator.ts#L176)

Check if the accumulator has been finalized

###### Returns

`boolean`

##### id

###### Get Signature

> **get** **id**(): [`ChatId`](../chat.md#chatid)

Defined in: [chat/accumulator.ts:41](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/accumulator.ts#L41)

Get current message ID

###### Returns

[`ChatId`](../chat.md#chatid)

#### Methods

##### apply()

> **apply**(`event`): `void`

Defined in: [chat/accumulator.ts:48](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/accumulator.ts#L48)

Apply an AgentEvent to accumulate into the message

###### Parameters

###### event

[`AgentEvent`](../index.md#agentevent)

AgentEvent to process

###### Returns

`void`

###### Throws

Error if accumulator is already finalized

##### finalize()

> **finalize**(): [`ChatMessage`](../chat.md#chatmessage)

Defined in: [chat/accumulator.ts:141](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/accumulator.ts#L141)

Finalize the accumulator and return the complete ChatMessage

###### Returns

[`ChatMessage`](../chat.md#chatmessage)

Completed ChatMessage with all parts finalized

###### Throws

Error if accumulator is already finalized

##### snapshot()

> **snapshot**(): [`ChatMessage`](../chat.md#chatmessage)

Defined in: [chat/accumulator.ts:124](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/accumulator.ts#L124)

Get a snapshot of the current accumulated message (for streaming UI)

###### Returns

[`ChatMessage`](../chat.md#chatmessage)

ChatMessage with current parts and "streaming" status

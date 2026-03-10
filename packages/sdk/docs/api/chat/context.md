[**@witqq/agent-sdk**](../README.md)

***

[@witqq/agent-sdk](../README.md) / chat/context

# chat/context

## Classes

### ContextWindowManager

Defined in: [chat/context.ts:192](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L192)

Stateless context window manager.
Takes messages and returns the subset that fits within a token budget.

#### Example

```typescript
const manager = new ContextWindowManager({
  maxTokens: 4096,
  reservedTokens: 500,
  strategy: "sliding-window",
});

const result = manager.fitMessages(messages);
// result.messages — trimmed to fit budget
// result.totalTokens — estimated token usage
// result.wasTruncated — whether messages were removed
```

#### Constructors

##### Constructor

> **new ContextWindowManager**(`config`): [`ContextWindowManager`](#contextwindowmanager)

Defined in: [chat/context.ts:198](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L198)

###### Parameters

###### config

[`ContextWindowConfig`](#contextwindowconfig)

###### Returns

[`ContextWindowManager`](#contextwindowmanager)

#### Accessors

##### availableBudget

###### Get Signature

> **get** **availableBudget**(): `number`

Defined in: [chat/context.ts:209](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L209)

Available token budget after reserving tokens

###### Returns

`number`

#### Methods

##### estimateMessageTokens()

> **estimateMessageTokens**(`message`): `number`

Defined in: [chat/context.ts:218](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L218)

Estimate tokens for a single message.

###### Parameters

###### message

[`ChatMessage`](../chat.md#chatmessage)

Message to estimate

###### Returns

`number`

Estimated token count

##### fitMessages()

> **fitMessages**(`messages`): [`ContextWindowResult`](#contextwindowresult)

Defined in: [chat/context.ts:227](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L227)

Fit messages within the token budget using the configured strategy.

###### Parameters

###### messages

readonly [`ChatMessage`](../chat.md#chatmessage)\<`unknown`\>[]

All messages to consider

###### Returns

[`ContextWindowResult`](#contextwindowresult)

Result with fitted messages and metadata

##### fitMessagesAsync()

> **fitMessagesAsync**(`messages`): `Promise`\<[`ContextWindowResult`](#contextwindowresult)\>

Defined in: [chat/context.ts:265](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L265)

Async variant of fitMessages that supports async summarization.
When strategy is "summarize-placeholder" and a summarizer is configured,
calls the summarizer with removed messages and replaces the placeholder text.
Falls back to static placeholder if summarizer throws.
For other strategies, behaves identically to fitMessages().

###### Parameters

###### messages

readonly [`ChatMessage`](../chat.md#chatmessage)\<`unknown`\>[]

###### Returns

`Promise`\<[`ContextWindowResult`](#contextwindowresult)\>

##### fitMessagesWithUsage()

> **fitMessagesWithUsage**(`messages`, `lastPromptTokens`, `modelContextWindow`): [`ContextWindowResult`](#contextwindowresult)

Defined in: [chat/context.ts:314](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L314)

Trim messages using real token usage data from the previous API call.
Uses average-based algorithm: `avgTokensPerMessage = lastPromptTokens / messageCount`.
Removes oldest non-system messages until freed budget brings usage under modelContextWindow.

###### Parameters

###### messages

readonly [`ChatMessage`](../chat.md#chatmessage)\<`unknown`\>[]

All messages in the session

###### lastPromptTokens

`number`

Real prompt tokens from the last API response

###### modelContextWindow

`number`

Model's total context window size in tokens

###### Returns

[`ContextWindowResult`](#contextwindowresult)

Result with fitted messages and metadata

## Interfaces

### ContextStats

Defined in: [chat/context.ts:155](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L155)

Context usage statistics for a session.
Returned by `IChatRuntime.getContextStats()`.

When real usage data is available (after the first API response),
`realPromptTokens` and `realCompletionTokens` contain actual token counts.
`modelContextWindow` is the model's context window from `listModels()`.

#### Properties

##### availableBudget

> **availableBudget**: `number`

Defined in: [chat/context.ts:163](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L163)

Available token budget (maxTokens − reservedTokens)

##### modelContextWindow?

> `optional` **modelContextWindow**: `number`

Defined in: [chat/context.ts:169](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L169)

Model's context window in tokens from listModels() (undefined if not available)

##### realCompletionTokens?

> `optional` **realCompletionTokens**: `number`

Defined in: [chat/context.ts:167](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L167)

Real completion tokens from the last API response (undefined before first response)

##### realPromptTokens?

> `optional` **realPromptTokens**: `number`

Defined in: [chat/context.ts:165](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L165)

Real prompt tokens from the last API response (undefined before first response)

##### removedCount

> **removedCount**: `number`

Defined in: [chat/context.ts:159](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L159)

Number of messages removed by trimming

##### totalTokens

> **totalTokens**: `number`

Defined in: [chat/context.ts:157](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L157)

Estimated total tokens in the trimmed context (heuristic, kept for backward compat)

##### wasTruncated

> **wasTruncated**: `boolean`

Defined in: [chat/context.ts:161](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L161)

Whether context was truncated

***

### ContextWindowConfig

Defined in: [chat/context.ts:99](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L99)

Configuration for the context window manager.

#### Properties

##### estimation?

> `optional` **estimation**: [`TokenEstimationOptions`](#tokenestimationoptions)

Defined in: [chat/context.ts:119](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L119)

Token estimation options.

##### maxTokens

> **maxTokens**: `number`

Defined in: [chat/context.ts:101](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L101)

Maximum token budget for the context window

##### reservedTokens?

> `optional` **reservedTokens**: `number`

Defined in: [chat/context.ts:108](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L108)

Tokens reserved for system prompt and response generation.
Subtracted from maxTokens to get available budget.

###### Default

```ts
0
```

##### strategy?

> `optional` **strategy**: [`OverflowStrategy`](#overflowstrategy)

Defined in: [chat/context.ts:114](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L114)

Strategy for handling overflow when messages exceed budget.

###### Default

```ts
"truncate-oldest"
```

##### summarizer?

> `optional` **summarizer**: [`ContextSummarizer`](#contextsummarizer)

Defined in: [chat/context.ts:126](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L126)

Optional async summarizer for the summarize-placeholder strategy.
When provided, replaces the static placeholder with a generated summary.
Falls back to static placeholder if summarizer throws.

***

### ContextWindowResult

Defined in: [chat/context.ts:134](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L134)

Result of context window trimming.

#### Properties

##### messages

> **messages**: [`ChatMessage`](../chat.md#chatmessage)\<`unknown`\>[]

Defined in: [chat/context.ts:136](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L136)

Messages that fit within the budget

##### removedCount

> **removedCount**: `number`

Defined in: [chat/context.ts:140](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L140)

Number of messages removed

##### totalTokens

> **totalTokens**: `number`

Defined in: [chat/context.ts:138](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L138)

Total estimated tokens for included messages

##### wasTruncated

> **wasTruncated**: `boolean`

Defined in: [chat/context.ts:142](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L142)

Whether any messages were truncated

***

### TokenEstimationOptions

Defined in: [chat/context.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L16)

Options for token estimation.

#### Properties

##### charsPerToken?

> `optional` **charsPerToken**: `number`

Defined in: [chat/context.ts:22](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L22)

Characters per token ratio.
Lower = more conservative (fewer messages fit).

###### Default

```ts
4
```

## Type Aliases

### ContextSummarizer()

> **ContextSummarizer** = (`removedMessages`) => `Promise`\<`string`\>

Defined in: [chat/context.ts:94](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L94)

Async summarizer function for the summarize-placeholder strategy.
Receives removed messages and returns a summary string.
When configured, replaces the static placeholder text with actual summary.

#### Parameters

##### removedMessages

readonly [`ChatMessage`](../chat.md#chatmessage)[]

#### Returns

`Promise`\<`string`\>

***

### OverflowStrategy

> **OverflowStrategy** = `"truncate-oldest"` \| `"sliding-window"` \| `"summarize-placeholder"`

Defined in: [chat/context.ts:82](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L82)

Overflow strategy type

## Functions

### estimateTokens()

> **estimateTokens**(`message`, `options?`): `number`

Defined in: [chat/context.ts:45](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/context.ts#L45)

Estimate token count for a single chat message.
Uses character-based heuristic: `Math.ceil(charCount / charsPerToken)`.

Counts:
- Text content (string or text parts)
- Serialized tool calls and tool results
- Thinking blocks
- Role overhead (~4 tokens)

#### Parameters

##### message

[`ChatMessage`](../chat.md#chatmessage)

Chat message to estimate

##### options?

[`TokenEstimationOptions`](#tokenestimationoptions)

Estimation options

#### Returns

`number`

Estimated token count

#### Example

```typescript
const tokens = estimateTokens(message);
const conservative = estimateTokens(message, { charsPerToken: 3 });
```

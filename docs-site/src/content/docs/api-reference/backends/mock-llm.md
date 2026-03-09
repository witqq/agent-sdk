---
title: "Mock LLM Backend"
description: "Mock backend for testing"
sidebar:
  order: 13
---
# backends/mock-llm

## Interfaces

### MockLLMBackendOptions

Defined in: [types/backends.ts:35](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L35)

Options for Mock LLM backend

#### Properties

##### finishReason?

> `optional` **finishReason**: `string`

Defined in: [types/backends.ts:45](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L45)

Override finishReason in done events (default: "stop")

##### latency?

> `optional` **latency**: [`MockLLMLatency`](#mockllmlatency)

Defined in: [types/backends.ts:41](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L41)

Latency simulation — delay before each response

##### mode?

> `optional` **mode**: [`MockLLMResponseMode`](#mockllmresponsemode)

Defined in: [types/backends.ts:37](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L37)

Response mode configuration

##### models?

> `optional` **models**: `object`[]

Defined in: [types/backends.ts:39](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L39)

Models to advertise from listModels()

###### description?

> `optional` **description**: `string`

###### id

> **id**: `string`

###### name?

> `optional` **name**: `string`

##### permissions?

> `optional` **permissions**: [`MockLLMPermissionOptions`](#mockllmpermissionoptions)

Defined in: [types/backends.ts:47](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L47)

Permission simulation for tool calls

##### streaming?

> `optional` **streaming**: [`MockLLMStreamingOptions`](#mockllmstreamingoptions)

Defined in: [types/backends.ts:43](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L43)

Streaming behavior control

##### structuredOutput?

> `optional` **structuredOutput**: `unknown`

Defined in: [types/backends.ts:51](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L51)

Structured output — return specific JSON from runStructured()

##### toolCalls?

> `optional` **toolCalls**: [`MockLLMToolCall`](#mockllmtoolcall)[]

Defined in: [types/backends.ts:49](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L49)

Tool call simulation — emit tool_call_start/end events during streaming

***

### MockLLMPermissionOptions

Defined in: [types/backends.ts:75](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L75)

Permission simulation options

#### Properties

##### autoApprove?

> `optional` **autoApprove**: `boolean`

Defined in: [types/backends.ts:79](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L79)

Auto-approve all permission requests (default: false — uses supervisor callback)

##### denyTools?

> `optional` **denyTools**: `string`[]

Defined in: [types/backends.ts:81](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L81)

Tool names to always deny

##### toolNames

> **toolNames**: `string`[]

Defined in: [types/backends.ts:77](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L77)

Tool names to simulate permission requests for

***

### MockLLMStreamingOptions

Defined in: [types/backends.ts:67](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L67)

Streaming chunk control

#### Properties

##### chunkDelayMs?

> `optional` **chunkDelayMs**: `number`

Defined in: [types/backends.ts:71](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L71)

Delay in ms between chunks (default: 0)

##### chunkSize?

> `optional` **chunkSize**: `number`

Defined in: [types/backends.ts:69](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L69)

Characters per chunk (default: word-boundary splitting)

***

### MockLLMToolCall

Defined in: [types/backends.ts:85](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L85)

Tool call simulation — emitted as tool_call_start/end events in stream

#### Properties

##### args?

> `optional` **args**: `Record`\<`string`, `unknown`\>

Defined in: [types/backends.ts:89](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L89)

Tool call arguments

##### result?

> `optional` **result**: `unknown`

Defined in: [types/backends.ts:91](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L91)

Tool execution result

##### toolCallId?

> `optional` **toolCallId**: `string`

Defined in: [types/backends.ts:93](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L93)

Tool call ID (auto-generated if not provided)

##### toolName

> **toolName**: `string`

Defined in: [types/backends.ts:87](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L87)

Tool name (e.g. "bash", "file_write")

## Type Aliases

### MockLLMLatency

> **MockLLMLatency** = \{ `ms`: `number`; `type`: `"fixed"`; \} \| \{ `maxMs`: `number`; `minMs`: `number`; `type`: `"random"`; \}

Defined in: [types/backends.ts:62](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L62)

Latency simulation configuration

***

### MockLLMResponseMode

> **MockLLMResponseMode** = \{ `type`: `"echo"`; \} \| \{ `response`: `string`; `type`: `"static"`; \} \| \{ `loop?`: `boolean`; `responses`: `string`[]; `type`: `"scripted"`; \} \| \{ `code?`: `string`; `error`: `string`; `recoverable?`: `boolean`; `type`: `"error"`; \}

Defined in: [types/backends.ts:55](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/types/backends.ts#L55)

Response mode — determines how the mock agent generates responses

## Functions

### createMockLLMService()

> **createMockLLMService**(`options?`): [`IAgentService`](/api-reference/core/#iagentservice)

Defined in: backends/mock-llm.ts:418

Create a mock LLM backend service for automated testing.

 Unlike the lightweight `createMockAgentService` (from `@witqq/agent-sdk/testing`),
 this backend extends `BaseAgent` and participates in the full agent lifecycle:
 retry, heartbeat, activity timeout, middleware pipeline, and usage enrichment.

#### Parameters

##### options?

[`MockLLMBackendOptions`](#mockllmbackendoptions) = `{}`

#### Returns

[`IAgentService`](/api-reference/core/#iagentservice)

#### Example

```ts
 import { createMockLLMService } from "@witqq/agent-sdk/mock-llm";

 // Basic echo mode
 const service = createMockLLMService({ mode: { type: "echo" } });

 // With latency simulation and streaming control
 const realisticService = createMockLLMService({
   mode: { type: "static", response: "Hello!" },
   latency: { type: "fixed", ms: 100 },
   streaming: { chunkSize: 5, chunkDelayMs: 10 },
   finishReason: "stop",
 });

 // With permission simulation
 const permService = createMockLLMService({
   mode: { type: "echo" },
   permissions: { toolNames: ["bash", "file_write"], autoApprove: true },
 });
 ```

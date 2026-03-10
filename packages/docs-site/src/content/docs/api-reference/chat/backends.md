---
title: "Chat Backends"
description: "Chat backend adapter interfaces and base classes"
sidebar:
  order: 30
---
# chat/backends

## Classes

### `abstract` ResumableChatAdapter

Defined in: [chat/backends/resumable.ts:28](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/resumable.ts#L28)

Abstract base for backend adapters that support session resume.
Handles backendSessionId tracking, canResume(), resume(), captureSessionId().
Subclasses only define constructor (with backend-specific options) and createService().

#### Extends

- [`BaseBackendAdapter`](/api-reference/chat/index-exports/#abstract-basebackendadapter)

#### Extended by

- [`CopilotChatAdapter`](/api-reference/chat/index-exports/#copilotchatadapter)
- [`ClaudeChatAdapter`](/api-reference/chat/index-exports/#claudechatadapter)

#### Implements

- [`IResumableBackend`](/api-reference/chat/index-exports/#iresumablebackend)

#### Constructors

##### Constructor

> **new ResumableChatAdapter**(`name`, `options`): [`ResumableChatAdapter`](#abstract-resumablechatadapter)

Defined in: [chat/backends/resumable.ts:31](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/resumable.ts#L31)

###### Parameters

###### name

`string`

###### options

[`BackendAdapterOptions`](/api-reference/chat/index-exports/#backendadapteroptions)

###### Returns

[`ResumableChatAdapter`](#abstract-resumablechatadapter)

###### Overrides

[`BaseBackendAdapter`](/api-reference/chat/index-exports/#abstract-basebackendadapter).[`constructor`](/api-reference/chat/index-exports/#constructor)

#### Properties

##### \_agentConfig

> `protected` `readonly` **\_agentConfig**: [`FullAgentConfig`](/api-reference/core/#fullagentconfig)

Defined in: [chat/backends/base.ts:39](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L39)

###### Inherited from

[`BaseBackendAdapter`](/api-reference/chat/index-exports/#abstract-basebackendadapter).[`_agentConfig`](/api-reference/chat/index-exports/#_agentconfig)

##### name

> `readonly` **name**: `string`

Defined in: [chat/backends/base.ts:35](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L35)

Backend name (e.g. "copilot", "claude", "vercel-ai")

###### Implementation of

[`IResumableBackend`](/api-reference/chat/index-exports/#iresumablebackend).[`name`](/api-reference/chat/index-exports/#name-5)

###### Inherited from

[`BaseBackendAdapter`](/api-reference/chat/index-exports/#abstract-basebackendadapter).[`name`](/api-reference/chat/index-exports/#name)

#### Accessors

##### agentService

###### Get Signature

> **get** **agentService**(): [`IAgentService`](/api-reference/core/#iagentservice)

Defined in: [chat/backends/base.ts:64](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L64)

###### Returns

[`IAgentService`](/api-reference/core/#iagentservice)

###### Inherited from

[`BaseBackendAdapter`](/api-reference/chat/index-exports/#abstract-basebackendadapter).[`agentService`](/api-reference/chat/index-exports/#agentservice-1)

##### backendSessionId

###### Get Signature

> **get** **backendSessionId**(): `string` \| `null`

Defined in: [chat/backends/resumable.ts:40](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/resumable.ts#L40)

The backend session ID from the last stream, or null if not yet streamed

###### Returns

`string` \| `null`

The backend session ID from the last stream, or null if not yet streamed

###### Implementation of

[`IResumableBackend`](/api-reference/chat/index-exports/#iresumablebackend).[`backendSessionId`](/api-reference/chat/index-exports/#backendsessionid-3)

##### currentModel

###### Get Signature

> **get** **currentModel**(): `string` \| `undefined`

Defined in: [chat/backends/base.ts:78](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L78)

Current effective model

###### Returns

`string` \| `undefined`

Current effective model

###### Implementation of

[`IResumableBackend`](/api-reference/chat/index-exports/#iresumablebackend).[`currentModel`](/api-reference/chat/index-exports/#currentmodel-4)

###### Inherited from

[`BaseBackendAdapter`](/api-reference/chat/index-exports/#abstract-basebackendadapter).[`currentModel`](/api-reference/chat/index-exports/#currentmodel)

#### Methods

##### assertNotDisposed()

> `protected` **assertNotDisposed**(): `void`

Defined in: [chat/backends/base.ts:243](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L243)

###### Returns

`void`

###### Inherited from

[`BaseBackendAdapter`](/api-reference/chat/index-exports/#abstract-basebackendadapter).[`assertNotDisposed`](/api-reference/chat/index-exports/#assertnotdisposed)

##### canResume()

> **canResume**(): `boolean`

Defined in: [chat/backends/resumable.ts:44](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/resumable.ts#L44)

Whether this adapter supports session resume

###### Returns

`boolean`

###### Implementation of

[`IResumableBackend`](/api-reference/chat/index-exports/#iresumablebackend).[`canResume`](/api-reference/chat/index-exports/#canresume-2)

##### captureSessionId()

> `protected` **captureSessionId**(`agent`): `void`

Defined in: [chat/backends/resumable.ts:82](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/resumable.ts#L82)

Subclasses capture backend session ID from agent after streaming

###### Parameters

###### agent

[`IAgent`](/api-reference/core/#iagent)

###### Returns

`void`

###### Overrides

[`BaseBackendAdapter`](/api-reference/chat/index-exports/#abstract-basebackendadapter).[`captureSessionId`](/api-reference/chat/index-exports/#capturesessionid)

##### createService()

> `abstract` `protected` **createService**(): [`IAgentService`](/api-reference/core/#iagentservice)

Defined in: [chat/backends/base.ts:62](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L62)

Subclasses create their specific IAgentService

###### Returns

[`IAgentService`](/api-reference/core/#iagentservice)

###### Inherited from

[`BaseBackendAdapter`](/api-reference/chat/index-exports/#abstract-basebackendadapter).[`createService`](/api-reference/chat/index-exports/#createservice)

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [chat/backends/base.ts:196](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L196)

Dispose resources

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IResumableBackend`](/api-reference/chat/index-exports/#iresumablebackend).[`dispose`](/api-reference/chat/index-exports/#dispose-5)

###### Inherited from

[`BaseBackendAdapter`](/api-reference/chat/index-exports/#abstract-basebackendadapter).[`dispose`](/api-reference/chat/index-exports/#dispose)

##### getOrCreateAgent()

> `protected` **getOrCreateAgent**(`options?`): [`IAgent`](/api-reference/core/#iagent)

Defined in: [chat/backends/base.ts:211](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L211)

Get or create an agent. Model is passed per-call via RunOptions.
 Tools are passed per-call via SendMessageOptions — not baked into config.
 For persistent sessions, reuses agent when model matches.

###### Parameters

###### options?

[`SendMessageOptions`](/api-reference/chat/index-exports/#sendmessageoptions)

###### Returns

[`IAgent`](/api-reference/core/#iagent)

###### Inherited from

[`BaseBackendAdapter`](/api-reference/chat/index-exports/#abstract-basebackendadapter).[`getOrCreateAgent`](/api-reference/chat/index-exports/#getorcreateagent)

##### listModels()

> **listModels**(): `Promise`\<[`ModelInfo`](/api-reference/core/#modelinfo)[]\>

Defined in: [chat/backends/base.ts:186](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L186)

List available models

###### Returns

`Promise`\<[`ModelInfo`](/api-reference/core/#modelinfo)[]\>

###### Implementation of

[`IResumableBackend`](/api-reference/chat/index-exports/#iresumablebackend).[`listModels`](/api-reference/chat/index-exports/#listmodels-4)

###### Inherited from

[`BaseBackendAdapter`](/api-reference/chat/index-exports/#abstract-basebackendadapter).[`listModels`](/api-reference/chat/index-exports/#listmodels)

##### resume()

> **resume**(`session`, `backendSessionId`, `options?`): `AsyncIterable`\<[`ChatEvent`](/api-reference/chat/index-exports/#chatevent)\>

Defined in: [chat/backends/resumable.ts:48](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/resumable.ts#L48)

Resume a previous session by its backend session ID.
Streams events from the resumed session.

###### Parameters

###### session

[`ChatSession`](/api-reference/chat/index-exports/#chatsession)

###### backendSessionId

`string`

###### options?

[`SendMessageOptions`](/api-reference/chat/index-exports/#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](/api-reference/chat/index-exports/#chatevent)\>

###### Throws

ChatError with SESSION_EXPIRED if session is no longer valid

###### Throws

ChatError with SESSION_NOT_FOUND if session ID is unknown

###### Implementation of

[`IResumableBackend`](/api-reference/chat/index-exports/#iresumablebackend).[`resume`](/api-reference/chat/index-exports/#resume-2)

##### sendMessage()

> **sendMessage**(`session`, `message`, `options?`): `Promise`\<[`ChatMessage`](/api-reference/chat/index-exports/#chatmessage)\<`unknown`\>\>

Defined in: [chat/backends/base.ts:90](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L90)

Send a message and receive a complete response

###### Parameters

###### session

[`ChatSession`](/api-reference/chat/index-exports/#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](/api-reference/chat/index-exports/#sendmessageoptions)

###### Returns

`Promise`\<[`ChatMessage`](/api-reference/chat/index-exports/#chatmessage)\<`unknown`\>\>

###### Implementation of

[`IResumableBackend`](/api-reference/chat/index-exports/#iresumablebackend).[`sendMessage`](/api-reference/chat/index-exports/#sendmessage-4)

###### Inherited from

[`BaseBackendAdapter`](/api-reference/chat/index-exports/#abstract-basebackendadapter).[`sendMessage`](/api-reference/chat/index-exports/#sendmessage)

##### ~~setTools()~~

> **setTools**(): `void`

Defined in: [chat/backends/base.ts:86](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L86)

###### Returns

`void`

###### Deprecated

No-op. Tools are passed per-call via SendMessageOptions.tools.
Kept for backward compatibility with code that calls setTools() directly.

###### Inherited from

[`BaseBackendAdapter`](/api-reference/chat/index-exports/#abstract-basebackendadapter).[`setTools`](/api-reference/chat/index-exports/#settools)

##### streamAgentEvents()

> `protected` **streamAgentEvents**(`agent`, `messages`, `options?`): `AsyncIterable`\<[`ChatEvent`](/api-reference/chat/index-exports/#chatevent)\>

Defined in: [chat/backends/base.ts:144](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L144)

Shared streaming helper: bridges agent events to chat events.
Used by both streamMessage() and resume() to avoid duplication.

###### Parameters

###### agent

[`IAgent`](/api-reference/core/#iagent)

###### messages

[`Message`](/api-reference/core/#message)[]

###### options?

[`SendMessageOptions`](/api-reference/chat/index-exports/#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](/api-reference/chat/index-exports/#chatevent)\>

###### Inherited from

[`BaseBackendAdapter`](/api-reference/chat/index-exports/#abstract-basebackendadapter).[`streamAgentEvents`](/api-reference/chat/index-exports/#streamagentevents)

##### streamMessage()

> **streamMessage**(`session`, `message`, `options?`): `AsyncIterable`\<[`ChatEvent`](/api-reference/chat/index-exports/#chatevent)\>

Defined in: [chat/backends/base.ts:124](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L124)

Stream a message response as ChatEvents

###### Parameters

###### session

[`ChatSession`](/api-reference/chat/index-exports/#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](/api-reference/chat/index-exports/#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](/api-reference/chat/index-exports/#chatevent)\>

###### Implementation of

[`IResumableBackend`](/api-reference/chat/index-exports/#iresumablebackend).[`streamMessage`](/api-reference/chat/index-exports/#streammessage-4)

###### Inherited from

[`BaseBackendAdapter`](/api-reference/chat/index-exports/#abstract-basebackendadapter).[`streamMessage`](/api-reference/chat/index-exports/#streammessage)

##### validate()

> **validate**(): `Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

Defined in: [chat/backends/base.ts:191](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L191)

Validate backend configuration/credentials

###### Returns

`Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

###### Implementation of

[`IResumableBackend`](/api-reference/chat/index-exports/#iresumablebackend).[`validate`](/api-reference/chat/index-exports/#validate-4)

###### Inherited from

[`BaseBackendAdapter`](/api-reference/chat/index-exports/#abstract-basebackendadapter).[`validate`](/api-reference/chat/index-exports/#validate)

## Interfaces

### ClaudeChatAdapterOptions

Defined in: [chat/backends/claude.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/claude.ts#L18)

Options for creating a ClaudeChatAdapter

#### Extends

- [`BackendAdapterOptions`](/api-reference/chat/index-exports/#backendadapteroptions)

#### Properties

##### agentConfig

> **agentConfig**: [`FullAgentConfig`](/api-reference/core/#fullagentconfig)

Defined in: [chat/backends/types.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L25)

Agent configuration (model, systemPrompt, tools, etc.)

###### Inherited from

[`BackendAdapterOptions`](/api-reference/chat/index-exports/#backendadapteroptions).[`agentConfig`](/api-reference/chat/index-exports/#agentconfig)

##### agentService?

> `optional` **agentService**: [`IAgentService`](/api-reference/core/#iagentservice)

Defined in: [chat/backends/types.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L27)

Pre-created agent service (if adapter should not own lifecycle)

###### Inherited from

[`BackendAdapterOptions`](/api-reference/chat/index-exports/#backendadapteroptions).[`agentService`](/api-reference/chat/index-exports/#agentservice)

##### agentServiceFactory()?

> `optional` **agentServiceFactory**: () => [`IAgentService`](/api-reference/core/#iagentservice)

Defined in: [chat/backends/types.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L29)

Factory for lazy service creation (called on first use, not at construction)

###### Returns

[`IAgentService`](/api-reference/core/#iagentservice)

###### Inherited from

[`BackendAdapterOptions`](/api-reference/chat/index-exports/#backendadapteroptions).[`agentServiceFactory`](/api-reference/chat/index-exports/#agentservicefactory)

##### claudeOptions?

> `optional` **claudeOptions**: [`ClaudeBackendOptions`](/api-reference/core/#claudebackendoptions)

Defined in: [chat/backends/claude.ts:20](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/claude.ts#L20)

Claude backend options (cliPath, model, etc.)

***

### CloseDetectable

Defined in: [chat/backends/transport.ts:42](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L42)

Minimal interface for detecting client disconnection

#### Methods

##### on()

> **on**(`event`, `listener`): `void`

Defined in: [chat/backends/transport.ts:43](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L43)

###### Parameters

###### event

`"close"`

###### listener

() => `void`

###### Returns

`void`

***

### CopilotChatAdapterOptions

Defined in: [chat/backends/copilot.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/copilot.ts#L18)

Options for creating a CopilotChatAdapter

#### Extends

- [`BackendAdapterOptions`](/api-reference/chat/index-exports/#backendadapteroptions)

#### Properties

##### agentConfig

> **agentConfig**: [`FullAgentConfig`](/api-reference/core/#fullagentconfig)

Defined in: [chat/backends/types.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L25)

Agent configuration (model, systemPrompt, tools, etc.)

###### Inherited from

[`BackendAdapterOptions`](/api-reference/chat/index-exports/#backendadapteroptions).[`agentConfig`](/api-reference/chat/index-exports/#agentconfig)

##### agentService?

> `optional` **agentService**: [`IAgentService`](/api-reference/core/#iagentservice)

Defined in: [chat/backends/types.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L27)

Pre-created agent service (if adapter should not own lifecycle)

###### Inherited from

[`BackendAdapterOptions`](/api-reference/chat/index-exports/#backendadapteroptions).[`agentService`](/api-reference/chat/index-exports/#agentservice)

##### agentServiceFactory()?

> `optional` **agentServiceFactory**: () => [`IAgentService`](/api-reference/core/#iagentservice)

Defined in: [chat/backends/types.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L29)

Factory for lazy service creation (called on first use, not at construction)

###### Returns

[`IAgentService`](/api-reference/core/#iagentservice)

###### Inherited from

[`BackendAdapterOptions`](/api-reference/chat/index-exports/#backendadapteroptions).[`agentServiceFactory`](/api-reference/chat/index-exports/#agentservicefactory)

##### copilotOptions?

> `optional` **copilotOptions**: [`CopilotBackendOptions`](/api-reference/core/#copilotbackendoptions)

Defined in: [chat/backends/copilot.ts:20](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/copilot.ts#L20)

Copilot backend options (cliPath, token, etc.)

***

### InterceptorContext

Defined in: [chat/backends/interceptors.ts:24](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/interceptors.ts#L24)

Context passed to interceptor hooks

#### Properties

##### event

> **event**: [`ChatEvent`](/api-reference/chat/index-exports/#chatevent)

Defined in: [chat/backends/interceptors.ts:26](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/interceptors.ts#L26)

The event being intercepted (mutable for beforeSend)

##### transport

> **transport**: [`IChatTransport`](/api-reference/chat/index-exports/#ichattransport)

Defined in: [chat/backends/interceptors.ts:28](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/interceptors.ts#L28)

The underlying transport being wrapped

***

### MockLLMChatAdapterOptions

Defined in: [chat/backends/mock-llm.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/mock-llm.ts#L16)

Options for creating a MockLLMChatAdapter

#### Extends

- [`BackendAdapterOptions`](/api-reference/chat/index-exports/#backendadapteroptions)

#### Properties

##### agentConfig

> **agentConfig**: [`FullAgentConfig`](/api-reference/core/#fullagentconfig)

Defined in: [chat/backends/types.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L25)

Agent configuration (model, systemPrompt, tools, etc.)

###### Inherited from

[`BackendAdapterOptions`](/api-reference/chat/index-exports/#backendadapteroptions).[`agentConfig`](/api-reference/chat/index-exports/#agentconfig)

##### agentService?

> `optional` **agentService**: [`IAgentService`](/api-reference/core/#iagentservice)

Defined in: [chat/backends/types.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L27)

Pre-created agent service (if adapter should not own lifecycle)

###### Inherited from

[`BackendAdapterOptions`](/api-reference/chat/index-exports/#backendadapteroptions).[`agentService`](/api-reference/chat/index-exports/#agentservice)

##### agentServiceFactory()?

> `optional` **agentServiceFactory**: () => [`IAgentService`](/api-reference/core/#iagentservice)

Defined in: [chat/backends/types.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L29)

Factory for lazy service creation (called on first use, not at construction)

###### Returns

[`IAgentService`](/api-reference/core/#iagentservice)

###### Inherited from

[`BackendAdapterOptions`](/api-reference/chat/index-exports/#backendadapteroptions).[`agentServiceFactory`](/api-reference/chat/index-exports/#agentservicefactory)

##### mockOptions?

> `optional` **mockOptions**: [`MockLLMBackendOptions`](/api-reference/backends/mock-llm/#mockllmbackendoptions)

Defined in: [chat/backends/mock-llm.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/mock-llm.ts#L18)

MockLLM backend options (mode, latency, streaming, etc.)

***

### SSETransportOptions

Defined in: [chat/backends/transport.ts:47](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L47)

Configuration options for SSEChatTransport

#### Properties

##### heartbeatMs?

> `optional` **heartbeatMs**: `number`

Defined in: [chat/backends/transport.ts:49](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L49)

Heartbeat interval in milliseconds. 0 or undefined disables heartbeat.

##### request?

> `optional` **request**: [`CloseDetectable`](#closedetectable)

Defined in: [chat/backends/transport.ts:51](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L51)

Request object for detecting client disconnection (listens for 'close' event)

***

### TransportInterceptor

Defined in: [chat/backends/interceptors.ts:35](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/interceptors.ts#L35)

Transport interceptor with lifecycle hooks.
All hooks are optional — implement only what you need.

#### Properties

##### name?

> `optional` **name**: `string`

Defined in: [chat/backends/interceptors.ts:37](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/interceptors.ts#L37)

Optional name for debugging

#### Methods

##### afterSend()?

> `optional` **afterSend**(`event`, `transport`): `void`

Defined in: [chat/backends/interceptors.ts:46](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/interceptors.ts#L46)

Called after each event is sent to the transport

###### Parameters

###### event

[`ChatEvent`](/api-reference/chat/index-exports/#chatevent)

###### transport

[`IChatTransport`](/api-reference/chat/index-exports/#ichattransport)

###### Returns

`void`

##### beforeClose()?

> `optional` **beforeClose**(`transport`): `void`

Defined in: [chat/backends/interceptors.ts:49](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/interceptors.ts#L49)

Called before the transport is closed

###### Parameters

###### transport

[`IChatTransport`](/api-reference/chat/index-exports/#ichattransport)

###### Returns

`void`

##### beforeSend()?

> `optional` **beforeSend**(`event`, `transport`): [`ChatEvent`](/api-reference/chat/index-exports/#chatevent) \| `null`

Defined in: [chat/backends/interceptors.ts:43](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/interceptors.ts#L43)

Called before each event is sent to the transport.
Return the event to send, a modified event, or null to suppress.

###### Parameters

###### event

[`ChatEvent`](/api-reference/chat/index-exports/#chatevent)

###### transport

[`IChatTransport`](/api-reference/chat/index-exports/#ichattransport)

###### Returns

[`ChatEvent`](/api-reference/chat/index-exports/#chatevent) \| `null`

##### onError()?

> `optional` **onError**(`error`, `transport`): `void`

Defined in: [chat/backends/interceptors.ts:52](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/interceptors.ts#L52)

Called when an error is signaled on the transport

###### Parameters

###### error

`Error`

###### transport

[`IChatTransport`](/api-reference/chat/index-exports/#ichattransport)

###### Returns

`void`

***

### VercelAIChatAdapterOptions

Defined in: [chat/backends/vercel-ai.ts:20](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/vercel-ai.ts#L20)

Options for creating a VercelAIChatAdapter

#### Extends

- [`BackendAdapterOptions`](/api-reference/chat/index-exports/#backendadapteroptions)

#### Properties

##### agentConfig

> **agentConfig**: [`FullAgentConfig`](/api-reference/core/#fullagentconfig)

Defined in: [chat/backends/types.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L25)

Agent configuration (model, systemPrompt, tools, etc.)

###### Inherited from

[`BackendAdapterOptions`](/api-reference/chat/index-exports/#backendadapteroptions).[`agentConfig`](/api-reference/chat/index-exports/#agentconfig)

##### agentService?

> `optional` **agentService**: [`IAgentService`](/api-reference/core/#iagentservice)

Defined in: [chat/backends/types.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L27)

Pre-created agent service (if adapter should not own lifecycle)

###### Inherited from

[`BackendAdapterOptions`](/api-reference/chat/index-exports/#backendadapteroptions).[`agentService`](/api-reference/chat/index-exports/#agentservice)

##### agentServiceFactory()?

> `optional` **agentServiceFactory**: () => [`IAgentService`](/api-reference/core/#iagentservice)

Defined in: [chat/backends/types.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L29)

Factory for lazy service creation (called on first use, not at construction)

###### Returns

[`IAgentService`](/api-reference/core/#iagentservice)

###### Inherited from

[`BackendAdapterOptions`](/api-reference/chat/index-exports/#backendadapteroptions).[`agentServiceFactory`](/api-reference/chat/index-exports/#agentservicefactory)

##### vercelOptions?

> `optional` **vercelOptions**: [`VercelAIBackendOptions`](/api-reference/core/#vercelaibackendoptions)

Defined in: [chat/backends/vercel-ai.ts:22](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/vercel-ai.ts#L22)

Vercel AI backend options (baseURL, apiKey, provider, etc.)

***

### WebSocketLike

Defined in: [chat/backends/ws-transport.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/ws-transport.ts#L25)

Minimal WebSocket interface compatible with `ws`, browser WebSocket, Deno, Bun.
Only the methods/properties used by WsChatTransport.

#### Properties

##### readyState

> `readonly` **readyState**: `number`

Defined in: [chat/backends/ws-transport.ts:26](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/ws-transport.ts#L26)

#### Methods

##### addEventListener()

###### Call Signature

> **addEventListener**(`type`, `listener`): `void`

Defined in: [chat/backends/ws-transport.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/ws-transport.ts#L29)

###### Parameters

###### type

`"close"`

###### listener

() => `void`

###### Returns

`void`

###### Call Signature

> **addEventListener**(`type`, `listener`): `void`

Defined in: [chat/backends/ws-transport.ts:30](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/ws-transport.ts#L30)

###### Parameters

###### type

`"error"`

###### listener

(`err`) => `void`

###### Returns

`void`

##### close()

> **close**(`code?`, `reason?`): `void`

Defined in: [chat/backends/ws-transport.ts:28](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/ws-transport.ts#L28)

###### Parameters

###### code?

`number`

###### reason?

`string`

###### Returns

`void`

##### send()

> **send**(`data`): `void`

Defined in: [chat/backends/ws-transport.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/ws-transport.ts#L27)

###### Parameters

###### data

`string`

###### Returns

`void`

***

### WritableResponse

Defined in: [chat/backends/transport.ts:33](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L33)

Writable HTTP response interface — minimal type satisfied by Express, Fastify (raw), and Node http.ServerResponse without casts.

#### Properties

##### writableEnded

> `readonly` **writableEnded**: `boolean`

Defined in: [chat/backends/transport.ts:38](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L38)

#### Methods

##### end()

> **end**(`body?`): `unknown`

Defined in: [chat/backends/transport.ts:37](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L37)

###### Parameters

###### body?

`string`

###### Returns

`unknown`

##### setHeader()

> **setHeader**(`name`, `value`): `unknown`

Defined in: [chat/backends/transport.ts:35](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L35)

###### Parameters

###### name

`string`

###### value

`string`

###### Returns

`unknown`

##### write()

> **write**(`chunk`): `boolean`

Defined in: [chat/backends/transport.ts:36](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L36)

###### Parameters

###### chunk

`string`

###### Returns

`boolean`

##### writeHead()

> **writeHead**(`statusCode`, `headers?`): `unknown`

Defined in: [chat/backends/transport.ts:34](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L34)

###### Parameters

###### statusCode

`number`

###### headers?

`Record`\<`string`, `string` \| `string`[]\>

###### Returns

`unknown`

***

### WsTransportOptions

Defined in: [chat/backends/ws-transport.ts:34](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/ws-transport.ts#L34)

Configuration options for WsChatTransport

#### Properties

##### heartbeatMs?

> `optional` **heartbeatMs**: `number`

Defined in: [chat/backends/ws-transport.ts:36](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/ws-transport.ts#L36)

Heartbeat interval in ms. 0 or undefined disables heartbeat.

##### serialize()?

> `optional` **serialize**: (`event`) => `string`

Defined in: [chat/backends/ws-transport.ts:38](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/ws-transport.ts#L38)

Custom JSON serializer (defaults to JSON.stringify)

###### Parameters

###### event

[`ChatEvent`](/api-reference/chat/index-exports/#chatevent)

###### Returns

`string`

## Variables

### WS\_READY\_STATE

> `const` **WS\_READY\_STATE**: `object`

Defined in: [chat/backends/ws-transport.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/ws-transport.ts#L14)

Ready states matching the WebSocket spec (ws, browser, Deno, Bun)

#### Type Declaration

##### CLOSED

> `readonly` **CLOSED**: `3` = `3`

##### CLOSING

> `readonly` **CLOSING**: `2` = `2`

##### CONNECTING

> `readonly` **CONNECTING**: `0` = `0`

##### OPEN

> `readonly` **OPEN**: `1` = `1`

## Functions

### withInterceptors()

> **withInterceptors**(`transport`, `interceptors`): [`IChatTransport`](/api-reference/chat/index-exports/#ichattransport)

Defined in: [chat/backends/interceptors.ts:128](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/interceptors.ts#L128)

Wrap a transport with one or more interceptors.
Interceptors are applied in order: first interceptor's beforeSend runs first.

#### Parameters

##### transport

[`IChatTransport`](/api-reference/chat/index-exports/#ichattransport)

Base transport to wrap

##### interceptors

[`TransportInterceptor`](#transportinterceptor)[]

Array of interceptors to apply

#### Returns

[`IChatTransport`](/api-reference/chat/index-exports/#ichattransport)

Wrapped transport with interceptor hooks

## References

### BackendAdapterOptions

Re-exports [BackendAdapterOptions](/api-reference/chat/index-exports/#backendadapteroptions)

***

### BaseBackendAdapter

Re-exports [BaseBackendAdapter](/api-reference/chat/index-exports/#abstract-basebackendadapter)

***

### ClaudeChatAdapter

Re-exports [ClaudeChatAdapter](/api-reference/chat/index-exports/#claudechatadapter)

***

### CopilotChatAdapter

Re-exports [CopilotChatAdapter](/api-reference/chat/index-exports/#copilotchatadapter)

***

### IChatBackend

Re-exports [IChatBackend](/api-reference/chat/index-exports/#ichatbackend)

***

### IChatTransport

Re-exports [IChatTransport](/api-reference/chat/index-exports/#ichattransport)

***

### InProcessChatTransport

Re-exports [InProcessChatTransport](/api-reference/chat/index-exports/#inprocesschattransport)

***

### IResumableBackend

Re-exports [IResumableBackend](/api-reference/chat/index-exports/#iresumablebackend)

***

### isResumableBackend

Re-exports [isResumableBackend](/api-reference/chat/index-exports/#isresumablebackend)

***

### MockLLMChatAdapter

Re-exports [MockLLMChatAdapter](/api-reference/chat/index-exports/#mockllmchatadapter)

***

### SSEChatTransport

Re-exports [SSEChatTransport](/api-reference/chat/index-exports/#ssechattransport)

***

### streamToTransport

Re-exports [streamToTransport](/api-reference/chat/index-exports/#streamtotransport)

***

### VercelAIChatAdapter

Re-exports [VercelAIChatAdapter](/api-reference/chat/index-exports/#vercelaichatadapter)

***

### WsChatTransport

Re-exports [WsChatTransport](/api-reference/chat/index-exports/#wschattransport)

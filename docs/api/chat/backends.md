[**@witqq/agent-sdk**](../README.md)

***

[@witqq/agent-sdk](../README.md) / chat/backends

# chat/backends

## Classes

### `abstract` ResumableChatAdapter

Defined in: [chat/backends/resumable.ts:28](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/resumable.ts#L28)

Abstract base for backend adapters that support session resume.
Handles backendSessionId tracking, canResume(), resume(), captureSessionId().
Subclasses only define constructor (with backend-specific options) and createService().

#### Extends

- [`BaseBackendAdapter`](../chat.md#abstract-basebackendadapter)

#### Extended by

- [`CopilotChatAdapter`](../chat.md#copilotchatadapter)
- [`ClaudeChatAdapter`](../chat.md#claudechatadapter)

#### Implements

- [`IResumableBackend`](../chat.md#iresumablebackend)

#### Constructors

##### Constructor

> **new ResumableChatAdapter**(`name`, `options`): [`ResumableChatAdapter`](#abstract-resumablechatadapter)

Defined in: [chat/backends/resumable.ts:31](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/resumable.ts#L31)

###### Parameters

###### name

`string`

###### options

[`BackendAdapterOptions`](../chat.md#backendadapteroptions)

###### Returns

[`ResumableChatAdapter`](#abstract-resumablechatadapter)

###### Overrides

[`BaseBackendAdapter`](../chat.md#abstract-basebackendadapter).[`constructor`](../chat.md#constructor)

#### Properties

##### \_agentConfig

> `protected` `readonly` **\_agentConfig**: [`FullAgentConfig`](../index.md#fullagentconfig)

Defined in: [chat/backends/base.ts:39](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/base.ts#L39)

###### Inherited from

[`BaseBackendAdapter`](../chat.md#abstract-basebackendadapter).[`_agentConfig`](../chat.md#_agentconfig)

##### name

> `readonly` **name**: `string`

Defined in: [chat/backends/base.ts:35](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/base.ts#L35)

Backend name (e.g. "copilot", "claude", "vercel-ai")

###### Implementation of

[`IResumableBackend`](../chat.md#iresumablebackend).[`name`](../chat.md#name-5)

###### Inherited from

[`BaseBackendAdapter`](../chat.md#abstract-basebackendadapter).[`name`](../chat.md#name)

#### Accessors

##### agentService

###### Get Signature

> **get** **agentService**(): [`IAgentService`](../index.md#iagentservice)

Defined in: [chat/backends/base.ts:64](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/base.ts#L64)

###### Returns

[`IAgentService`](../index.md#iagentservice)

###### Inherited from

[`BaseBackendAdapter`](../chat.md#abstract-basebackendadapter).[`agentService`](../chat.md#agentservice-1)

##### backendSessionId

###### Get Signature

> **get** **backendSessionId**(): `string` \| `null`

Defined in: [chat/backends/resumable.ts:40](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/resumable.ts#L40)

The backend session ID from the last stream, or null if not yet streamed

###### Returns

`string` \| `null`

The backend session ID from the last stream, or null if not yet streamed

###### Implementation of

[`IResumableBackend`](../chat.md#iresumablebackend).[`backendSessionId`](../chat.md#backendsessionid-3)

##### currentModel

###### Get Signature

> **get** **currentModel**(): `string` \| `undefined`

Defined in: [chat/backends/base.ts:78](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/base.ts#L78)

Current effective model

###### Returns

`string` \| `undefined`

Current effective model

###### Implementation of

[`IResumableBackend`](../chat.md#iresumablebackend).[`currentModel`](../chat.md#currentmodel-4)

###### Inherited from

[`BaseBackendAdapter`](../chat.md#abstract-basebackendadapter).[`currentModel`](../chat.md#currentmodel)

#### Methods

##### assertNotDisposed()

> `protected` **assertNotDisposed**(): `void`

Defined in: [chat/backends/base.ts:243](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/base.ts#L243)

###### Returns

`void`

###### Inherited from

[`BaseBackendAdapter`](../chat.md#abstract-basebackendadapter).[`assertNotDisposed`](../chat.md#assertnotdisposed)

##### canResume()

> **canResume**(): `boolean`

Defined in: [chat/backends/resumable.ts:44](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/resumable.ts#L44)

Whether this adapter supports session resume

###### Returns

`boolean`

###### Implementation of

[`IResumableBackend`](../chat.md#iresumablebackend).[`canResume`](../chat.md#canresume-2)

##### captureSessionId()

> `protected` **captureSessionId**(`agent`): `void`

Defined in: [chat/backends/resumable.ts:82](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/resumable.ts#L82)

Subclasses capture backend session ID from agent after streaming

###### Parameters

###### agent

[`IAgent`](../index.md#iagent)

###### Returns

`void`

###### Overrides

[`BaseBackendAdapter`](../chat.md#abstract-basebackendadapter).[`captureSessionId`](../chat.md#capturesessionid)

##### createService()

> `abstract` `protected` **createService**(): [`IAgentService`](../index.md#iagentservice)

Defined in: [chat/backends/base.ts:62](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/base.ts#L62)

Subclasses create their specific IAgentService

###### Returns

[`IAgentService`](../index.md#iagentservice)

###### Inherited from

[`BaseBackendAdapter`](../chat.md#abstract-basebackendadapter).[`createService`](../chat.md#createservice)

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [chat/backends/base.ts:196](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/base.ts#L196)

Dispose resources

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IResumableBackend`](../chat.md#iresumablebackend).[`dispose`](../chat.md#dispose-5)

###### Inherited from

[`BaseBackendAdapter`](../chat.md#abstract-basebackendadapter).[`dispose`](../chat.md#dispose)

##### getOrCreateAgent()

> `protected` **getOrCreateAgent**(`options?`): [`IAgent`](../index.md#iagent)

Defined in: [chat/backends/base.ts:211](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/base.ts#L211)

Get or create an agent. Model is passed per-call via RunOptions.
 Tools are passed per-call via SendMessageOptions — not baked into config.
 For persistent sessions, reuses agent when model matches.

###### Parameters

###### options?

[`SendMessageOptions`](../chat.md#sendmessageoptions)

###### Returns

[`IAgent`](../index.md#iagent)

###### Inherited from

[`BaseBackendAdapter`](../chat.md#abstract-basebackendadapter).[`getOrCreateAgent`](../chat.md#getorcreateagent)

##### listModels()

> **listModels**(): `Promise`\<[`ModelInfo`](../index.md#modelinfo)[]\>

Defined in: [chat/backends/base.ts:186](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/base.ts#L186)

List available models

###### Returns

`Promise`\<[`ModelInfo`](../index.md#modelinfo)[]\>

###### Implementation of

[`IResumableBackend`](../chat.md#iresumablebackend).[`listModels`](../chat.md#listmodels-4)

###### Inherited from

[`BaseBackendAdapter`](../chat.md#abstract-basebackendadapter).[`listModels`](../chat.md#listmodels)

##### resume()

> **resume**(`session`, `backendSessionId`, `options?`): `AsyncIterable`\<[`ChatEvent`](../chat.md#chatevent)\>

Defined in: [chat/backends/resumable.ts:48](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/resumable.ts#L48)

Resume a previous session by its backend session ID.
Streams events from the resumed session.

###### Parameters

###### session

[`ChatSession`](../chat.md#chatsession)

###### backendSessionId

`string`

###### options?

[`SendMessageOptions`](../chat.md#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](../chat.md#chatevent)\>

###### Throws

ChatError with SESSION_EXPIRED if session is no longer valid

###### Throws

ChatError with SESSION_NOT_FOUND if session ID is unknown

###### Implementation of

[`IResumableBackend`](../chat.md#iresumablebackend).[`resume`](../chat.md#resume-2)

##### sendMessage()

> **sendMessage**(`session`, `message`, `options?`): `Promise`\<[`ChatMessage`](../chat.md#chatmessage)\<`unknown`\>\>

Defined in: [chat/backends/base.ts:90](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/base.ts#L90)

Send a message and receive a complete response

###### Parameters

###### session

[`ChatSession`](../chat.md#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](../chat.md#sendmessageoptions)

###### Returns

`Promise`\<[`ChatMessage`](../chat.md#chatmessage)\<`unknown`\>\>

###### Implementation of

[`IResumableBackend`](../chat.md#iresumablebackend).[`sendMessage`](../chat.md#sendmessage-4)

###### Inherited from

[`BaseBackendAdapter`](../chat.md#abstract-basebackendadapter).[`sendMessage`](../chat.md#sendmessage)

##### ~~setTools()~~

> **setTools**(): `void`

Defined in: [chat/backends/base.ts:86](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/base.ts#L86)

###### Returns

`void`

###### Deprecated

No-op. Tools are passed per-call via SendMessageOptions.tools.
Kept for backward compatibility with code that calls setTools() directly.

###### Inherited from

[`BaseBackendAdapter`](../chat.md#abstract-basebackendadapter).[`setTools`](../chat.md#settools)

##### streamAgentEvents()

> `protected` **streamAgentEvents**(`agent`, `messages`, `options?`): `AsyncIterable`\<[`ChatEvent`](../chat.md#chatevent)\>

Defined in: [chat/backends/base.ts:144](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/base.ts#L144)

Shared streaming helper: bridges agent events to chat events.
Used by both streamMessage() and resume() to avoid duplication.

###### Parameters

###### agent

[`IAgent`](../index.md#iagent)

###### messages

[`Message`](../index.md#message)[]

###### options?

[`SendMessageOptions`](../chat.md#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](../chat.md#chatevent)\>

###### Inherited from

[`BaseBackendAdapter`](../chat.md#abstract-basebackendadapter).[`streamAgentEvents`](../chat.md#streamagentevents)

##### streamMessage()

> **streamMessage**(`session`, `message`, `options?`): `AsyncIterable`\<[`ChatEvent`](../chat.md#chatevent)\>

Defined in: [chat/backends/base.ts:124](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/base.ts#L124)

Stream a message response as ChatEvents

###### Parameters

###### session

[`ChatSession`](../chat.md#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](../chat.md#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](../chat.md#chatevent)\>

###### Implementation of

[`IResumableBackend`](../chat.md#iresumablebackend).[`streamMessage`](../chat.md#streammessage-4)

###### Inherited from

[`BaseBackendAdapter`](../chat.md#abstract-basebackendadapter).[`streamMessage`](../chat.md#streammessage)

##### validate()

> **validate**(): `Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

Defined in: [chat/backends/base.ts:191](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/base.ts#L191)

Validate backend configuration/credentials

###### Returns

`Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

###### Implementation of

[`IResumableBackend`](../chat.md#iresumablebackend).[`validate`](../chat.md#validate-4)

###### Inherited from

[`BaseBackendAdapter`](../chat.md#abstract-basebackendadapter).[`validate`](../chat.md#validate)

## Interfaces

### ClaudeChatAdapterOptions

Defined in: [chat/backends/claude.ts:18](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/claude.ts#L18)

Options for creating a ClaudeChatAdapter

#### Extends

- [`BackendAdapterOptions`](../chat.md#backendadapteroptions)

#### Properties

##### agentConfig

> **agentConfig**: [`FullAgentConfig`](../index.md#fullagentconfig)

Defined in: [chat/backends/types.ts:25](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/types.ts#L25)

Agent configuration (model, systemPrompt, tools, etc.)

###### Inherited from

[`BackendAdapterOptions`](../chat.md#backendadapteroptions).[`agentConfig`](../chat.md#agentconfig)

##### agentService?

> `optional` **agentService**: [`IAgentService`](../index.md#iagentservice)

Defined in: [chat/backends/types.ts:27](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/types.ts#L27)

Pre-created agent service (if adapter should not own lifecycle)

###### Inherited from

[`BackendAdapterOptions`](../chat.md#backendadapteroptions).[`agentService`](../chat.md#agentservice)

##### agentServiceFactory()?

> `optional` **agentServiceFactory**: () => [`IAgentService`](../index.md#iagentservice)

Defined in: [chat/backends/types.ts:29](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/types.ts#L29)

Factory for lazy service creation (called on first use, not at construction)

###### Returns

[`IAgentService`](../index.md#iagentservice)

###### Inherited from

[`BackendAdapterOptions`](../chat.md#backendadapteroptions).[`agentServiceFactory`](../chat.md#agentservicefactory)

##### claudeOptions?

> `optional` **claudeOptions**: [`ClaudeBackendOptions`](../index.md#claudebackendoptions)

Defined in: [chat/backends/claude.ts:20](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/claude.ts#L20)

Claude backend options (cliPath, model, etc.)

***

### CloseDetectable

Defined in: [chat/backends/transport.ts:42](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/transport.ts#L42)

Minimal interface for detecting client disconnection

#### Methods

##### on()

> **on**(`event`, `listener`): `void`

Defined in: [chat/backends/transport.ts:43](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/transport.ts#L43)

###### Parameters

###### event

`"close"`

###### listener

() => `void`

###### Returns

`void`

***

### CopilotChatAdapterOptions

Defined in: [chat/backends/copilot.ts:18](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/copilot.ts#L18)

Options for creating a CopilotChatAdapter

#### Extends

- [`BackendAdapterOptions`](../chat.md#backendadapteroptions)

#### Properties

##### agentConfig

> **agentConfig**: [`FullAgentConfig`](../index.md#fullagentconfig)

Defined in: [chat/backends/types.ts:25](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/types.ts#L25)

Agent configuration (model, systemPrompt, tools, etc.)

###### Inherited from

[`BackendAdapterOptions`](../chat.md#backendadapteroptions).[`agentConfig`](../chat.md#agentconfig)

##### agentService?

> `optional` **agentService**: [`IAgentService`](../index.md#iagentservice)

Defined in: [chat/backends/types.ts:27](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/types.ts#L27)

Pre-created agent service (if adapter should not own lifecycle)

###### Inherited from

[`BackendAdapterOptions`](../chat.md#backendadapteroptions).[`agentService`](../chat.md#agentservice)

##### agentServiceFactory()?

> `optional` **agentServiceFactory**: () => [`IAgentService`](../index.md#iagentservice)

Defined in: [chat/backends/types.ts:29](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/types.ts#L29)

Factory for lazy service creation (called on first use, not at construction)

###### Returns

[`IAgentService`](../index.md#iagentservice)

###### Inherited from

[`BackendAdapterOptions`](../chat.md#backendadapteroptions).[`agentServiceFactory`](../chat.md#agentservicefactory)

##### copilotOptions?

> `optional` **copilotOptions**: [`CopilotBackendOptions`](../index.md#copilotbackendoptions)

Defined in: [chat/backends/copilot.ts:20](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/copilot.ts#L20)

Copilot backend options (cliPath, token, etc.)

***

### InterceptorContext

Defined in: [chat/backends/interceptors.ts:24](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/interceptors.ts#L24)

Context passed to interceptor hooks

#### Properties

##### event

> **event**: [`ChatEvent`](../chat.md#chatevent)

Defined in: [chat/backends/interceptors.ts:26](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/interceptors.ts#L26)

The event being intercepted (mutable for beforeSend)

##### transport

> **transport**: [`IChatTransport`](../chat.md#ichattransport)

Defined in: [chat/backends/interceptors.ts:28](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/interceptors.ts#L28)

The underlying transport being wrapped

***

### MockLLMChatAdapterOptions

Defined in: chat/backends/mock-llm.ts:16

Options for creating a MockLLMChatAdapter

#### Extends

- [`BackendAdapterOptions`](../chat.md#backendadapteroptions)

#### Properties

##### agentConfig

> **agentConfig**: [`FullAgentConfig`](../index.md#fullagentconfig)

Defined in: [chat/backends/types.ts:25](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/types.ts#L25)

Agent configuration (model, systemPrompt, tools, etc.)

###### Inherited from

[`BackendAdapterOptions`](../chat.md#backendadapteroptions).[`agentConfig`](../chat.md#agentconfig)

##### agentService?

> `optional` **agentService**: [`IAgentService`](../index.md#iagentservice)

Defined in: [chat/backends/types.ts:27](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/types.ts#L27)

Pre-created agent service (if adapter should not own lifecycle)

###### Inherited from

[`BackendAdapterOptions`](../chat.md#backendadapteroptions).[`agentService`](../chat.md#agentservice)

##### agentServiceFactory()?

> `optional` **agentServiceFactory**: () => [`IAgentService`](../index.md#iagentservice)

Defined in: [chat/backends/types.ts:29](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/types.ts#L29)

Factory for lazy service creation (called on first use, not at construction)

###### Returns

[`IAgentService`](../index.md#iagentservice)

###### Inherited from

[`BackendAdapterOptions`](../chat.md#backendadapteroptions).[`agentServiceFactory`](../chat.md#agentservicefactory)

##### mockOptions?

> `optional` **mockOptions**: [`MockLLMBackendOptions`](../backends/mock-llm.md#mockllmbackendoptions)

Defined in: chat/backends/mock-llm.ts:18

MockLLM backend options (mode, latency, streaming, etc.)

***

### SSETransportOptions

Defined in: [chat/backends/transport.ts:47](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/transport.ts#L47)

Configuration options for SSEChatTransport

#### Properties

##### heartbeatMs?

> `optional` **heartbeatMs**: `number`

Defined in: [chat/backends/transport.ts:49](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/transport.ts#L49)

Heartbeat interval in milliseconds. 0 or undefined disables heartbeat.

##### request?

> `optional` **request**: [`CloseDetectable`](#closedetectable)

Defined in: [chat/backends/transport.ts:51](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/transport.ts#L51)

Request object for detecting client disconnection (listens for 'close' event)

***

### TransportInterceptor

Defined in: [chat/backends/interceptors.ts:35](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/interceptors.ts#L35)

Transport interceptor with lifecycle hooks.
All hooks are optional — implement only what you need.

#### Properties

##### name?

> `optional` **name**: `string`

Defined in: [chat/backends/interceptors.ts:37](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/interceptors.ts#L37)

Optional name for debugging

#### Methods

##### afterSend()?

> `optional` **afterSend**(`event`, `transport`): `void`

Defined in: [chat/backends/interceptors.ts:46](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/interceptors.ts#L46)

Called after each event is sent to the transport

###### Parameters

###### event

[`ChatEvent`](../chat.md#chatevent)

###### transport

[`IChatTransport`](../chat.md#ichattransport)

###### Returns

`void`

##### beforeClose()?

> `optional` **beforeClose**(`transport`): `void`

Defined in: [chat/backends/interceptors.ts:49](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/interceptors.ts#L49)

Called before the transport is closed

###### Parameters

###### transport

[`IChatTransport`](../chat.md#ichattransport)

###### Returns

`void`

##### beforeSend()?

> `optional` **beforeSend**(`event`, `transport`): [`ChatEvent`](../chat.md#chatevent) \| `null`

Defined in: [chat/backends/interceptors.ts:43](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/interceptors.ts#L43)

Called before each event is sent to the transport.
Return the event to send, a modified event, or null to suppress.

###### Parameters

###### event

[`ChatEvent`](../chat.md#chatevent)

###### transport

[`IChatTransport`](../chat.md#ichattransport)

###### Returns

[`ChatEvent`](../chat.md#chatevent) \| `null`

##### onError()?

> `optional` **onError**(`error`, `transport`): `void`

Defined in: [chat/backends/interceptors.ts:52](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/interceptors.ts#L52)

Called when an error is signaled on the transport

###### Parameters

###### error

`Error`

###### transport

[`IChatTransport`](../chat.md#ichattransport)

###### Returns

`void`

***

### VercelAIChatAdapterOptions

Defined in: [chat/backends/vercel-ai.ts:20](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/vercel-ai.ts#L20)

Options for creating a VercelAIChatAdapter

#### Extends

- [`BackendAdapterOptions`](../chat.md#backendadapteroptions)

#### Properties

##### agentConfig

> **agentConfig**: [`FullAgentConfig`](../index.md#fullagentconfig)

Defined in: [chat/backends/types.ts:25](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/types.ts#L25)

Agent configuration (model, systemPrompt, tools, etc.)

###### Inherited from

[`BackendAdapterOptions`](../chat.md#backendadapteroptions).[`agentConfig`](../chat.md#agentconfig)

##### agentService?

> `optional` **agentService**: [`IAgentService`](../index.md#iagentservice)

Defined in: [chat/backends/types.ts:27](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/types.ts#L27)

Pre-created agent service (if adapter should not own lifecycle)

###### Inherited from

[`BackendAdapterOptions`](../chat.md#backendadapteroptions).[`agentService`](../chat.md#agentservice)

##### agentServiceFactory()?

> `optional` **agentServiceFactory**: () => [`IAgentService`](../index.md#iagentservice)

Defined in: [chat/backends/types.ts:29](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/types.ts#L29)

Factory for lazy service creation (called on first use, not at construction)

###### Returns

[`IAgentService`](../index.md#iagentservice)

###### Inherited from

[`BackendAdapterOptions`](../chat.md#backendadapteroptions).[`agentServiceFactory`](../chat.md#agentservicefactory)

##### vercelOptions?

> `optional` **vercelOptions**: [`VercelAIBackendOptions`](../index.md#vercelaibackendoptions)

Defined in: [chat/backends/vercel-ai.ts:22](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/vercel-ai.ts#L22)

Vercel AI backend options (baseURL, apiKey, provider, etc.)

***

### WebSocketLike

Defined in: [chat/backends/ws-transport.ts:25](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/ws-transport.ts#L25)

Minimal WebSocket interface compatible with `ws`, browser WebSocket, Deno, Bun.
Only the methods/properties used by WsChatTransport.

#### Properties

##### readyState

> `readonly` **readyState**: `number`

Defined in: [chat/backends/ws-transport.ts:26](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/ws-transport.ts#L26)

#### Methods

##### addEventListener()

###### Call Signature

> **addEventListener**(`type`, `listener`): `void`

Defined in: [chat/backends/ws-transport.ts:29](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/ws-transport.ts#L29)

###### Parameters

###### type

`"close"`

###### listener

() => `void`

###### Returns

`void`

###### Call Signature

> **addEventListener**(`type`, `listener`): `void`

Defined in: [chat/backends/ws-transport.ts:30](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/ws-transport.ts#L30)

###### Parameters

###### type

`"error"`

###### listener

(`err`) => `void`

###### Returns

`void`

##### close()

> **close**(`code?`, `reason?`): `void`

Defined in: [chat/backends/ws-transport.ts:28](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/ws-transport.ts#L28)

###### Parameters

###### code?

`number`

###### reason?

`string`

###### Returns

`void`

##### send()

> **send**(`data`): `void`

Defined in: [chat/backends/ws-transport.ts:27](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/ws-transport.ts#L27)

###### Parameters

###### data

`string`

###### Returns

`void`

***

### WritableResponse

Defined in: [chat/backends/transport.ts:33](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/transport.ts#L33)

Writable HTTP response interface — minimal type satisfied by Express, Fastify (raw), and Node http.ServerResponse without casts.

#### Properties

##### writableEnded

> `readonly` **writableEnded**: `boolean`

Defined in: [chat/backends/transport.ts:38](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/transport.ts#L38)

#### Methods

##### end()

> **end**(`body?`): `unknown`

Defined in: [chat/backends/transport.ts:37](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/transport.ts#L37)

###### Parameters

###### body?

`string`

###### Returns

`unknown`

##### setHeader()

> **setHeader**(`name`, `value`): `unknown`

Defined in: [chat/backends/transport.ts:35](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/transport.ts#L35)

###### Parameters

###### name

`string`

###### value

`string`

###### Returns

`unknown`

##### write()

> **write**(`chunk`): `boolean`

Defined in: [chat/backends/transport.ts:36](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/transport.ts#L36)

###### Parameters

###### chunk

`string`

###### Returns

`boolean`

##### writeHead()

> **writeHead**(`statusCode`, `headers?`): `unknown`

Defined in: [chat/backends/transport.ts:34](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/transport.ts#L34)

###### Parameters

###### statusCode

`number`

###### headers?

`Record`\<`string`, `string` \| `string`[]\>

###### Returns

`unknown`

***

### WsTransportOptions

Defined in: [chat/backends/ws-transport.ts:34](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/ws-transport.ts#L34)

Configuration options for WsChatTransport

#### Properties

##### heartbeatMs?

> `optional` **heartbeatMs**: `number`

Defined in: [chat/backends/ws-transport.ts:36](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/ws-transport.ts#L36)

Heartbeat interval in ms. 0 or undefined disables heartbeat.

##### serialize()?

> `optional` **serialize**: (`event`) => `string`

Defined in: [chat/backends/ws-transport.ts:38](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/ws-transport.ts#L38)

Custom JSON serializer (defaults to JSON.stringify)

###### Parameters

###### event

[`ChatEvent`](../chat.md#chatevent)

###### Returns

`string`

## Variables

### WS\_READY\_STATE

> `const` **WS\_READY\_STATE**: `object`

Defined in: [chat/backends/ws-transport.ts:14](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/ws-transport.ts#L14)

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

> **withInterceptors**(`transport`, `interceptors`): [`IChatTransport`](../chat.md#ichattransport)

Defined in: [chat/backends/interceptors.ts:128](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/backends/interceptors.ts#L128)

Wrap a transport with one or more interceptors.
Interceptors are applied in order: first interceptor's beforeSend runs first.

#### Parameters

##### transport

[`IChatTransport`](../chat.md#ichattransport)

Base transport to wrap

##### interceptors

[`TransportInterceptor`](#transportinterceptor)[]

Array of interceptors to apply

#### Returns

[`IChatTransport`](../chat.md#ichattransport)

Wrapped transport with interceptor hooks

## References

### BackendAdapterOptions

Re-exports [BackendAdapterOptions](../chat.md#backendadapteroptions)

***

### BaseBackendAdapter

Re-exports [BaseBackendAdapter](../chat.md#abstract-basebackendadapter)

***

### ClaudeChatAdapter

Re-exports [ClaudeChatAdapter](../chat.md#claudechatadapter)

***

### CopilotChatAdapter

Re-exports [CopilotChatAdapter](../chat.md#copilotchatadapter)

***

### IChatBackend

Re-exports [IChatBackend](../chat.md#ichatbackend)

***

### IChatTransport

Re-exports [IChatTransport](../chat.md#ichattransport)

***

### InProcessChatTransport

Re-exports [InProcessChatTransport](../chat.md#inprocesschattransport)

***

### IResumableBackend

Re-exports [IResumableBackend](../chat.md#iresumablebackend)

***

### isResumableBackend

Re-exports [isResumableBackend](../chat.md#isresumablebackend)

***

### MockLLMChatAdapter

Re-exports [MockLLMChatAdapter](../chat.md#mockllmchatadapter)

***

### SSEChatTransport

Re-exports [SSEChatTransport](../chat.md#ssechattransport)

***

### streamToTransport

Re-exports [streamToTransport](../chat.md#streamtotransport)

***

### VercelAIChatAdapter

Re-exports [VercelAIChatAdapter](../chat.md#vercelaichatadapter)

***

### WsChatTransport

Re-exports [WsChatTransport](../chat.md#wschattransport)

[**@witqq/agent-sdk**](README.md)

***

[@witqq/agent-sdk](README.md) / chat

# chat

## Classes

### `abstract` BaseBackendAdapter

Defined in: [chat/backends/base.ts:34](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L34)

Abstract base for backend adapters implementing IChatBackend (core only).
Subclasses implement createService() for backend-specific service creation.
Resume support is NOT required — subclasses can implement IResumableBackend separately.

#### Extended by

- [`VercelAIChatAdapter`](#vercelaichatadapter)
- [`MockLLMChatAdapter`](#mockllmchatadapter)
- [`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter)

#### Implements

- [`IChatBackend`](#ichatbackend)

#### Constructors

##### Constructor

> **new BaseBackendAdapter**(`name`, `options`): [`BaseBackendAdapter`](#abstract-basebackendadapter)

Defined in: [chat/backends/base.ts:46](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L46)

###### Parameters

###### name

`string`

###### options

[`BackendAdapterOptions`](#backendadapteroptions)

###### Returns

[`BaseBackendAdapter`](#abstract-basebackendadapter)

#### Properties

##### \_agentConfig

> `protected` `readonly` **\_agentConfig**: [`FullAgentConfig`](index.md#fullagentconfig)

Defined in: [chat/backends/base.ts:39](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L39)

##### name

> `readonly` **name**: `string`

Defined in: [chat/backends/base.ts:35](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L35)

Backend name (e.g. "copilot", "claude", "vercel-ai")

###### Implementation of

[`IChatBackend`](#ichatbackend).[`name`](#name-4)

#### Accessors

##### agentService

###### Get Signature

> **get** **agentService**(): [`IAgentService`](index.md#iagentservice)

Defined in: [chat/backends/base.ts:64](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L64)

###### Returns

[`IAgentService`](index.md#iagentservice)

##### currentModel

###### Get Signature

> **get** **currentModel**(): `string` \| `undefined`

Defined in: [chat/backends/base.ts:78](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L78)

Current effective model

###### Returns

`string` \| `undefined`

Current effective model

###### Implementation of

[`IChatBackend`](#ichatbackend).[`currentModel`](#currentmodel-3)

#### Methods

##### assertNotDisposed()

> `protected` **assertNotDisposed**(): `void`

Defined in: [chat/backends/base.ts:243](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L243)

###### Returns

`void`

##### captureSessionId()

> `abstract` `protected` **captureSessionId**(`agent`): `void`

Defined in: [chat/backends/base.ts:241](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L241)

Subclasses capture backend session ID from agent after streaming

###### Parameters

###### agent

[`IAgent`](index.md#iagent)

###### Returns

`void`

##### createService()

> `abstract` `protected` **createService**(): [`IAgentService`](index.md#iagentservice)

Defined in: [chat/backends/base.ts:62](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L62)

Subclasses create their specific IAgentService

###### Returns

[`IAgentService`](index.md#iagentservice)

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [chat/backends/base.ts:196](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L196)

Dispose resources

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IChatBackend`](#ichatbackend).[`dispose`](#dispose-3)

##### getOrCreateAgent()

> `protected` **getOrCreateAgent**(`options?`): [`IAgent`](index.md#iagent)

Defined in: [chat/backends/base.ts:211](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L211)

Get or create an agent. Model is passed per-call via RunOptions.
 Tools are passed per-call via SendMessageOptions — not baked into config.
 For persistent sessions, reuses agent when model matches.

###### Parameters

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

[`IAgent`](index.md#iagent)

##### listModels()

> **listModels**(): `Promise`\<[`ModelInfo`](index.md#modelinfo)[]\>

Defined in: [chat/backends/base.ts:186](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L186)

List available models

###### Returns

`Promise`\<[`ModelInfo`](index.md#modelinfo)[]\>

###### Implementation of

[`IChatBackend`](#ichatbackend).[`listModels`](#listmodels-3)

##### sendMessage()

> **sendMessage**(`session`, `message`, `options?`): `Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\>\>

Defined in: [chat/backends/base.ts:90](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L90)

Send a message and receive a complete response

###### Parameters

###### session

[`ChatSession`](#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\>\>

###### Implementation of

[`IChatBackend`](#ichatbackend).[`sendMessage`](#sendmessage-3)

##### ~~setTools()~~

> **setTools**(): `void`

Defined in: [chat/backends/base.ts:86](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L86)

###### Returns

`void`

###### Deprecated

No-op. Tools are passed per-call via SendMessageOptions.tools.
Kept for backward compatibility with code that calls setTools() directly.

##### streamAgentEvents()

> `protected` **streamAgentEvents**(`agent`, `messages`, `options?`): `AsyncIterable`\<[`ChatEvent`](#chatevent)\>

Defined in: [chat/backends/base.ts:144](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L144)

Shared streaming helper: bridges agent events to chat events.
Used by both streamMessage() and resume() to avoid duplication.

###### Parameters

###### agent

[`IAgent`](index.md#iagent)

###### messages

[`Message`](index.md#message)[]

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](#chatevent)\>

##### streamMessage()

> **streamMessage**(`session`, `message`, `options?`): `AsyncIterable`\<[`ChatEvent`](#chatevent)\>

Defined in: [chat/backends/base.ts:124](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L124)

Stream a message response as ChatEvents

###### Parameters

###### session

[`ChatSession`](#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](#chatevent)\>

###### Implementation of

[`IChatBackend`](#ichatbackend).[`streamMessage`](#streammessage-3)

##### validate()

> **validate**(): `Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

Defined in: [chat/backends/base.ts:191](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L191)

Validate backend configuration/credentials

###### Returns

`Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

###### Implementation of

[`IChatBackend`](#ichatbackend).[`validate`](#validate-3)

***

### ClaudeChatAdapter

Defined in: [chat/backends/claude.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/claude.ts#L29)

Backend adapter for Claude CLI.
Uses persistent session mode for session resume via Claude's session_id.

#### Extends

- [`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter)

#### Constructors

##### Constructor

> **new ClaudeChatAdapter**(`options`): [`ClaudeChatAdapter`](#claudechatadapter)

Defined in: [chat/backends/claude.ts:32](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/claude.ts#L32)

###### Parameters

###### options

[`ClaudeChatAdapterOptions`](chat/backends.md#claudechatadapteroptions)

###### Returns

[`ClaudeChatAdapter`](#claudechatadapter)

###### Overrides

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`constructor`](chat/backends.md#constructor)

#### Properties

##### \_agentConfig

> `protected` `readonly` **\_agentConfig**: [`FullAgentConfig`](index.md#fullagentconfig)

Defined in: [chat/backends/base.ts:39](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L39)

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`_agentConfig`](chat/backends.md#_agentconfig)

##### name

> `readonly` **name**: `string`

Defined in: [chat/backends/base.ts:35](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L35)

Backend name (e.g. "copilot", "claude", "vercel-ai")

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`name`](chat/backends.md#name)

#### Accessors

##### agentService

###### Get Signature

> **get** **agentService**(): [`IAgentService`](index.md#iagentservice)

Defined in: [chat/backends/base.ts:64](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L64)

###### Returns

[`IAgentService`](index.md#iagentservice)

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`agentService`](chat/backends.md#agentservice-3)

##### backendSessionId

###### Get Signature

> **get** **backendSessionId**(): `string` \| `null`

Defined in: [chat/backends/resumable.ts:40](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/resumable.ts#L40)

The backend session ID from the last stream, or null if not yet streamed

###### Returns

`string` \| `null`

The backend session ID from the last stream, or null if not yet streamed

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`backendSessionId`](chat/backends.md#backendsessionid)

##### currentModel

###### Get Signature

> **get** **currentModel**(): `string` \| `undefined`

Defined in: [chat/backends/base.ts:78](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L78)

Current effective model

###### Returns

`string` \| `undefined`

Current effective model

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`currentModel`](chat/backends.md#currentmodel)

#### Methods

##### assertNotDisposed()

> `protected` **assertNotDisposed**(): `void`

Defined in: [chat/backends/base.ts:243](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L243)

###### Returns

`void`

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`assertNotDisposed`](chat/backends.md#assertnotdisposed)

##### canResume()

> **canResume**(): `boolean`

Defined in: [chat/backends/resumable.ts:44](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/resumable.ts#L44)

Whether this adapter supports session resume

###### Returns

`boolean`

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`canResume`](chat/backends.md#canresume)

##### captureSessionId()

> `protected` **captureSessionId**(`agent`): `void`

Defined in: [chat/backends/resumable.ts:82](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/resumable.ts#L82)

Subclasses capture backend session ID from agent after streaming

###### Parameters

###### agent

[`IAgent`](index.md#iagent)

###### Returns

`void`

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`captureSessionId`](chat/backends.md#capturesessionid)

##### createService()

> `protected` **createService**(): [`IAgentService`](index.md#iagentservice)

Defined in: [chat/backends/claude.ts:37](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/claude.ts#L37)

Subclasses create their specific IAgentService

###### Returns

[`IAgentService`](index.md#iagentservice)

###### Overrides

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`createService`](chat/backends.md#createservice)

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [chat/backends/base.ts:196](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L196)

Dispose resources

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`dispose`](chat/backends.md#dispose)

##### getOrCreateAgent()

> `protected` **getOrCreateAgent**(`options?`): [`IAgent`](index.md#iagent)

Defined in: [chat/backends/base.ts:211](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L211)

Get or create an agent. Model is passed per-call via RunOptions.
 Tools are passed per-call via SendMessageOptions — not baked into config.
 For persistent sessions, reuses agent when model matches.

###### Parameters

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

[`IAgent`](index.md#iagent)

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`getOrCreateAgent`](chat/backends.md#getorcreateagent)

##### listModels()

> **listModels**(): `Promise`\<[`ModelInfo`](index.md#modelinfo)[]\>

Defined in: [chat/backends/base.ts:186](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L186)

List available models

###### Returns

`Promise`\<[`ModelInfo`](index.md#modelinfo)[]\>

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`listModels`](chat/backends.md#listmodels)

##### resume()

> **resume**(`session`, `backendSessionId`, `options?`): `AsyncIterable`\<[`ChatEvent`](#chatevent)\>

Defined in: [chat/backends/resumable.ts:48](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/resumable.ts#L48)

Resume a previous session by its backend session ID.
Streams events from the resumed session.

###### Parameters

###### session

[`ChatSession`](#chatsession)

###### backendSessionId

`string`

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](#chatevent)\>

###### Throws

ChatError with SESSION_EXPIRED if session is no longer valid

###### Throws

ChatError with SESSION_NOT_FOUND if session ID is unknown

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`resume`](chat/backends.md#resume)

##### sendMessage()

> **sendMessage**(`session`, `message`, `options?`): `Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\>\>

Defined in: [chat/backends/base.ts:90](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L90)

Send a message and receive a complete response

###### Parameters

###### session

[`ChatSession`](#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\>\>

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`sendMessage`](chat/backends.md#sendmessage)

##### ~~setTools()~~

> **setTools**(): `void`

Defined in: [chat/backends/base.ts:86](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L86)

###### Returns

`void`

###### Deprecated

No-op. Tools are passed per-call via SendMessageOptions.tools.
Kept for backward compatibility with code that calls setTools() directly.

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`setTools`](chat/backends.md#settools)

##### streamAgentEvents()

> `protected` **streamAgentEvents**(`agent`, `messages`, `options?`): `AsyncIterable`\<[`ChatEvent`](#chatevent)\>

Defined in: [chat/backends/base.ts:144](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L144)

Shared streaming helper: bridges agent events to chat events.
Used by both streamMessage() and resume() to avoid duplication.

###### Parameters

###### agent

[`IAgent`](index.md#iagent)

###### messages

[`Message`](index.md#message)[]

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](#chatevent)\>

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`streamAgentEvents`](chat/backends.md#streamagentevents)

##### streamMessage()

> **streamMessage**(`session`, `message`, `options?`): `AsyncIterable`\<[`ChatEvent`](#chatevent)\>

Defined in: [chat/backends/base.ts:124](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L124)

Stream a message response as ChatEvents

###### Parameters

###### session

[`ChatSession`](#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](#chatevent)\>

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`streamMessage`](chat/backends.md#streammessage)

##### validate()

> **validate**(): `Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

Defined in: [chat/backends/base.ts:191](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L191)

Validate backend configuration/credentials

###### Returns

`Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`validate`](chat/backends.md#validate)

***

### CopilotChatAdapter

Defined in: [chat/backends/copilot.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/copilot.ts#L29)

Backend adapter for GitHub Copilot CLI.
Uses persistent session mode for session resume via CLI session ID.

#### Extends

- [`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter)

#### Constructors

##### Constructor

> **new CopilotChatAdapter**(`options`): [`CopilotChatAdapter`](#copilotchatadapter)

Defined in: [chat/backends/copilot.ts:32](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/copilot.ts#L32)

###### Parameters

###### options

[`CopilotChatAdapterOptions`](chat/backends.md#copilotchatadapteroptions)

###### Returns

[`CopilotChatAdapter`](#copilotchatadapter)

###### Overrides

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`constructor`](chat/backends.md#constructor)

#### Properties

##### \_agentConfig

> `protected` `readonly` **\_agentConfig**: [`FullAgentConfig`](index.md#fullagentconfig)

Defined in: [chat/backends/base.ts:39](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L39)

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`_agentConfig`](chat/backends.md#_agentconfig)

##### name

> `readonly` **name**: `string`

Defined in: [chat/backends/base.ts:35](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L35)

Backend name (e.g. "copilot", "claude", "vercel-ai")

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`name`](chat/backends.md#name)

#### Accessors

##### agentService

###### Get Signature

> **get** **agentService**(): [`IAgentService`](index.md#iagentservice)

Defined in: [chat/backends/base.ts:64](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L64)

###### Returns

[`IAgentService`](index.md#iagentservice)

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`agentService`](chat/backends.md#agentservice-3)

##### backendSessionId

###### Get Signature

> **get** **backendSessionId**(): `string` \| `null`

Defined in: [chat/backends/resumable.ts:40](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/resumable.ts#L40)

The backend session ID from the last stream, or null if not yet streamed

###### Returns

`string` \| `null`

The backend session ID from the last stream, or null if not yet streamed

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`backendSessionId`](chat/backends.md#backendsessionid)

##### currentModel

###### Get Signature

> **get** **currentModel**(): `string` \| `undefined`

Defined in: [chat/backends/base.ts:78](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L78)

Current effective model

###### Returns

`string` \| `undefined`

Current effective model

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`currentModel`](chat/backends.md#currentmodel)

#### Methods

##### assertNotDisposed()

> `protected` **assertNotDisposed**(): `void`

Defined in: [chat/backends/base.ts:243](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L243)

###### Returns

`void`

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`assertNotDisposed`](chat/backends.md#assertnotdisposed)

##### canResume()

> **canResume**(): `boolean`

Defined in: [chat/backends/resumable.ts:44](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/resumable.ts#L44)

Whether this adapter supports session resume

###### Returns

`boolean`

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`canResume`](chat/backends.md#canresume)

##### captureSessionId()

> `protected` **captureSessionId**(`agent`): `void`

Defined in: [chat/backends/resumable.ts:82](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/resumable.ts#L82)

Subclasses capture backend session ID from agent after streaming

###### Parameters

###### agent

[`IAgent`](index.md#iagent)

###### Returns

`void`

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`captureSessionId`](chat/backends.md#capturesessionid)

##### createService()

> `protected` **createService**(): [`IAgentService`](index.md#iagentservice)

Defined in: [chat/backends/copilot.ts:37](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/copilot.ts#L37)

Subclasses create their specific IAgentService

###### Returns

[`IAgentService`](index.md#iagentservice)

###### Overrides

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`createService`](chat/backends.md#createservice)

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [chat/backends/base.ts:196](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L196)

Dispose resources

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`dispose`](chat/backends.md#dispose)

##### getOrCreateAgent()

> `protected` **getOrCreateAgent**(`options?`): [`IAgent`](index.md#iagent)

Defined in: [chat/backends/base.ts:211](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L211)

Get or create an agent. Model is passed per-call via RunOptions.
 Tools are passed per-call via SendMessageOptions — not baked into config.
 For persistent sessions, reuses agent when model matches.

###### Parameters

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

[`IAgent`](index.md#iagent)

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`getOrCreateAgent`](chat/backends.md#getorcreateagent)

##### listModels()

> **listModels**(): `Promise`\<[`ModelInfo`](index.md#modelinfo)[]\>

Defined in: [chat/backends/base.ts:186](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L186)

List available models

###### Returns

`Promise`\<[`ModelInfo`](index.md#modelinfo)[]\>

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`listModels`](chat/backends.md#listmodels)

##### resume()

> **resume**(`session`, `backendSessionId`, `options?`): `AsyncIterable`\<[`ChatEvent`](#chatevent)\>

Defined in: [chat/backends/resumable.ts:48](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/resumable.ts#L48)

Resume a previous session by its backend session ID.
Streams events from the resumed session.

###### Parameters

###### session

[`ChatSession`](#chatsession)

###### backendSessionId

`string`

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](#chatevent)\>

###### Throws

ChatError with SESSION_EXPIRED if session is no longer valid

###### Throws

ChatError with SESSION_NOT_FOUND if session ID is unknown

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`resume`](chat/backends.md#resume)

##### sendMessage()

> **sendMessage**(`session`, `message`, `options?`): `Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\>\>

Defined in: [chat/backends/base.ts:90](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L90)

Send a message and receive a complete response

###### Parameters

###### session

[`ChatSession`](#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\>\>

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`sendMessage`](chat/backends.md#sendmessage)

##### ~~setTools()~~

> **setTools**(): `void`

Defined in: [chat/backends/base.ts:86](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L86)

###### Returns

`void`

###### Deprecated

No-op. Tools are passed per-call via SendMessageOptions.tools.
Kept for backward compatibility with code that calls setTools() directly.

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`setTools`](chat/backends.md#settools)

##### streamAgentEvents()

> `protected` **streamAgentEvents**(`agent`, `messages`, `options?`): `AsyncIterable`\<[`ChatEvent`](#chatevent)\>

Defined in: [chat/backends/base.ts:144](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L144)

Shared streaming helper: bridges agent events to chat events.
Used by both streamMessage() and resume() to avoid duplication.

###### Parameters

###### agent

[`IAgent`](index.md#iagent)

###### messages

[`Message`](index.md#message)[]

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](#chatevent)\>

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`streamAgentEvents`](chat/backends.md#streamagentevents)

##### streamMessage()

> **streamMessage**(`session`, `message`, `options?`): `AsyncIterable`\<[`ChatEvent`](#chatevent)\>

Defined in: [chat/backends/base.ts:124](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L124)

Stream a message response as ChatEvents

###### Parameters

###### session

[`ChatSession`](#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](#chatevent)\>

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`streamMessage`](chat/backends.md#streammessage)

##### validate()

> **validate**(): `Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

Defined in: [chat/backends/base.ts:191](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L191)

Validate backend configuration/credentials

###### Returns

`Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

###### Inherited from

[`ResumableChatAdapter`](chat/backends.md#abstract-resumablechatadapter).[`validate`](chat/backends.md#validate)

***

### InProcessChatTransport

Defined in: [chat/backends/in-process-transport.ts:35](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/in-process-transport.ts#L35)

In-process transport for ChatEvent streaming.
Producer pushes events via IChatTransport.send(), consumer reads via async iteration.

#### Example

```ts
const transport = new InProcessChatTransport();

// Consumer side (async iteration)
(async () => {
  for await (const event of transport) {
    console.log("Received:", event);
  }
})();

// Producer side (via streamToTransport or manual)
transport.send({ type: "message:start", messageId, role: "assistant" });
transport.send({ type: "message:delta", messageId, text: "Hello" });
transport.close();
```

#### Implements

- [`IChatTransport`](#ichattransport)

#### Constructors

##### Constructor

> **new InProcessChatTransport**(): [`InProcessChatTransport`](#inprocesschattransport)

###### Returns

[`InProcessChatTransport`](#inprocesschattransport)

#### Accessors

##### isOpen

###### Get Signature

> **get** **isOpen**(): `boolean`

Defined in: [chat/backends/in-process-transport.ts:41](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/in-process-transport.ts#L41)

Whether the transport is still open

###### Returns

`boolean`

Whether the transport is still open

###### Implementation of

[`IChatTransport`](#ichattransport).[`isOpen`](#isopen)

#### Methods

##### \[asyncIterator\]()

> **\[asyncIterator\]**(): `AsyncIterator`\<[`ChatEvent`](#chatevent)\>

Defined in: [chat/backends/in-process-transport.ts:94](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/in-process-transport.ts#L94)

###### Returns

`AsyncIterator`\<[`ChatEvent`](#chatevent)\>

##### close()

> **close**(): `void`

Defined in: [chat/backends/in-process-transport.ts:59](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/in-process-transport.ts#L59)

Signal stream completion and close the connection

###### Returns

`void`

###### Implementation of

[`IChatTransport`](#ichattransport).[`close`](#close)

##### error()

> **error**(`err`): `void`

Defined in: [chat/backends/in-process-transport.ts:71](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/in-process-transport.ts#L71)

Signal an error to the client

###### Parameters

###### err

`Error`

###### Returns

`void`

###### Implementation of

[`IChatTransport`](#ichattransport).[`error`](#error)

##### send()

> **send**(`event`): `void`

Defined in: [chat/backends/in-process-transport.ts:45](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/in-process-transport.ts#L45)

Send a single chat event to the client

###### Parameters

###### event

[`ChatEvent`](#chatevent)

###### Returns

`void`

###### Implementation of

[`IChatTransport`](#ichattransport).[`send`](#send)

***

### ListenerSet

Defined in: [chat/listener-set.ts:12](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/listener-set.ts#L12)

Generic listener set utility for subscribe/notify patterns.

Encapsulates the recurring pattern of:
- Set<callback> storage
- add(callback) → unsubscribe function
- notify(...args) with try/catch per listener
- clear() for disposal

#### Type Parameters

##### T

`T` *extends* (...`args`) => `void`

#### Constructors

##### Constructor

> **new ListenerSet**\<`T`\>(): [`ListenerSet`](#listenerset)\<`T`\>

###### Returns

[`ListenerSet`](#listenerset)\<`T`\>

#### Accessors

##### size

###### Get Signature

> **get** **size**(): `number`

Defined in: [chat/listener-set.ts:34](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/listener-set.ts#L34)

Current number of listeners.

###### Returns

`number`

#### Methods

##### add()

> **add**(`callback`): () => `void`

Defined in: [chat/listener-set.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/listener-set.ts#L16)

Add a listener. Returns an unsubscribe function.

###### Parameters

###### callback

`T`

###### Returns

> (): `void`

###### Returns

`void`

##### clear()

> **clear**(): `void`

Defined in: [chat/listener-set.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/listener-set.ts#L29)

Remove all listeners.

###### Returns

`void`

##### notify()

> **notify**(...`args`): `void`

Defined in: [chat/listener-set.ts:22](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/listener-set.ts#L22)

Notify all listeners with the given arguments. Errors are isolated per listener.

###### Parameters

###### args

...`Parameters`\<`T`\>

###### Returns

`void`

***

### MockLLMChatAdapter

Defined in: [chat/backends/mock-llm.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/mock-llm.ts#L27)

Backend adapter for Mock LLM.
Zero-auth, deterministic, fully configurable for E2E testing.

#### Extends

- [`BaseBackendAdapter`](#abstract-basebackendadapter)

#### Constructors

##### Constructor

> **new MockLLMChatAdapter**(`options`): [`MockLLMChatAdapter`](#mockllmchatadapter)

Defined in: [chat/backends/mock-llm.ts:28](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/mock-llm.ts#L28)

###### Parameters

###### options

[`MockLLMChatAdapterOptions`](chat/backends.md#mockllmchatadapteroptions)

###### Returns

[`MockLLMChatAdapter`](#mockllmchatadapter)

###### Overrides

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`constructor`](#constructor)

#### Properties

##### \_agentConfig

> `protected` `readonly` **\_agentConfig**: [`FullAgentConfig`](index.md#fullagentconfig)

Defined in: [chat/backends/base.ts:39](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L39)

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`_agentConfig`](#_agentconfig)

##### name

> `readonly` **name**: `string`

Defined in: [chat/backends/base.ts:35](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L35)

Backend name (e.g. "copilot", "claude", "vercel-ai")

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`name`](#name)

#### Accessors

##### agentService

###### Get Signature

> **get** **agentService**(): [`IAgentService`](index.md#iagentservice)

Defined in: [chat/backends/base.ts:64](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L64)

###### Returns

[`IAgentService`](index.md#iagentservice)

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`agentService`](#agentservice-1)

##### currentModel

###### Get Signature

> **get** **currentModel**(): `string` \| `undefined`

Defined in: [chat/backends/base.ts:78](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L78)

Current effective model

###### Returns

`string` \| `undefined`

Current effective model

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`currentModel`](#currentmodel)

#### Methods

##### assertNotDisposed()

> `protected` **assertNotDisposed**(): `void`

Defined in: [chat/backends/base.ts:243](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L243)

###### Returns

`void`

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`assertNotDisposed`](#assertnotdisposed)

##### captureSessionId()

> `protected` **captureSessionId**(`_agent`): `void`

Defined in: [chat/backends/mock-llm.ts:43](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/mock-llm.ts#L43)

Subclasses capture backend session ID from agent after streaming

###### Parameters

###### \_agent

[`IAgent`](index.md#iagent)

###### Returns

`void`

###### Overrides

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`captureSessionId`](#capturesessionid)

##### createService()

> `protected` **createService**(): [`IAgentService`](index.md#iagentservice)

Defined in: [chat/backends/mock-llm.ts:38](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/mock-llm.ts#L38)

Subclasses create their specific IAgentService

###### Returns

[`IAgentService`](index.md#iagentservice)

###### Overrides

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`createService`](#createservice)

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [chat/backends/base.ts:196](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L196)

Dispose resources

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`dispose`](#dispose)

##### getOrCreateAgent()

> `protected` **getOrCreateAgent**(`options?`): [`IAgent`](index.md#iagent)

Defined in: [chat/backends/base.ts:211](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L211)

Get or create an agent. Model is passed per-call via RunOptions.
 Tools are passed per-call via SendMessageOptions — not baked into config.
 For persistent sessions, reuses agent when model matches.

###### Parameters

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

[`IAgent`](index.md#iagent)

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`getOrCreateAgent`](#getorcreateagent)

##### listModels()

> **listModels**(): `Promise`\<[`ModelInfo`](index.md#modelinfo)[]\>

Defined in: [chat/backends/base.ts:186](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L186)

List available models

###### Returns

`Promise`\<[`ModelInfo`](index.md#modelinfo)[]\>

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`listModels`](#listmodels)

##### sendMessage()

> **sendMessage**(`session`, `message`, `options?`): `Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\>\>

Defined in: [chat/backends/base.ts:90](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L90)

Send a message and receive a complete response

###### Parameters

###### session

[`ChatSession`](#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\>\>

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`sendMessage`](#sendmessage)

##### ~~setTools()~~

> **setTools**(): `void`

Defined in: [chat/backends/base.ts:86](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L86)

###### Returns

`void`

###### Deprecated

No-op. Tools are passed per-call via SendMessageOptions.tools.
Kept for backward compatibility with code that calls setTools() directly.

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`setTools`](#settools)

##### streamAgentEvents()

> `protected` **streamAgentEvents**(`agent`, `messages`, `options?`): `AsyncIterable`\<[`ChatEvent`](#chatevent)\>

Defined in: [chat/backends/base.ts:144](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L144)

Shared streaming helper: bridges agent events to chat events.
Used by both streamMessage() and resume() to avoid duplication.

###### Parameters

###### agent

[`IAgent`](index.md#iagent)

###### messages

[`Message`](index.md#message)[]

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](#chatevent)\>

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`streamAgentEvents`](#streamagentevents)

##### streamMessage()

> **streamMessage**(`session`, `message`, `options?`): `AsyncIterable`\<[`ChatEvent`](#chatevent)\>

Defined in: [chat/backends/base.ts:124](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L124)

Stream a message response as ChatEvents

###### Parameters

###### session

[`ChatSession`](#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](#chatevent)\>

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`streamMessage`](#streammessage)

##### validate()

> **validate**(): `Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

Defined in: [chat/backends/base.ts:191](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L191)

Validate backend configuration/credentials

###### Returns

`Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`validate`](#validate)

***

### SSEChatTransport

Defined in: [chat/backends/transport.ts:58](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L58)

Server-Sent Events transport for ChatEvent streaming.
Sends events as `data: JSON\n\n` lines with SSE headers.

#### Implements

- [`IChatTransport`](#ichattransport)

#### Constructors

##### Constructor

> **new SSEChatTransport**(`res`, `options?`): [`SSEChatTransport`](#ssechattransport)

Defined in: [chat/backends/transport.ts:63](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L63)

###### Parameters

###### res

[`WritableResponse`](chat/backends.md#writableresponse)

###### options?

[`SSETransportOptions`](chat/backends.md#ssetransportoptions)

###### Returns

[`SSEChatTransport`](#ssechattransport)

#### Accessors

##### isOpen

###### Get Signature

> **get** **isOpen**(): `boolean`

Defined in: [chat/backends/transport.ts:94](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L94)

Whether the transport is still open

###### Returns

`boolean`

Whether the transport is still open

###### Implementation of

[`IChatTransport`](#ichattransport).[`isOpen`](#isopen)

#### Methods

##### close()

> **close**(): `void`

Defined in: [chat/backends/transport.ts:103](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L103)

Signal stream completion and close the connection

###### Returns

`void`

###### Implementation of

[`IChatTransport`](#ichattransport).[`close`](#close)

##### error()

> **error**(`err`): `void`

Defined in: [chat/backends/transport.ts:111](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L111)

Signal an error to the client

###### Parameters

###### err

`Error`

###### Returns

`void`

###### Implementation of

[`IChatTransport`](#ichattransport).[`error`](#error)

##### send()

> **send**(`event`): `void`

Defined in: [chat/backends/transport.ts:98](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L98)

Send a single chat event to the client

###### Parameters

###### event

[`ChatEvent`](#chatevent)

###### Returns

`void`

###### Implementation of

[`IChatTransport`](#ichattransport).[`send`](#send)

***

### VercelAIChatAdapter

Defined in: [chat/backends/vercel-ai.ts:32](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/vercel-ai.ts#L32)

Backend adapter for Vercel AI SDK (API-based).
Stateless — each call creates a fresh agent. Does not support resume.
Implements IChatBackend only (no IResumableBackend).

#### Extends

- [`BaseBackendAdapter`](#abstract-basebackendadapter)

#### Constructors

##### Constructor

> **new VercelAIChatAdapter**(`options`): [`VercelAIChatAdapter`](#vercelaichatadapter)

Defined in: [chat/backends/vercel-ai.ts:35](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/vercel-ai.ts#L35)

###### Parameters

###### options

[`VercelAIChatAdapterOptions`](chat/backends.md#vercelaichatadapteroptions)

###### Returns

[`VercelAIChatAdapter`](#vercelaichatadapter)

###### Overrides

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`constructor`](#constructor)

#### Properties

##### \_agentConfig

> `protected` `readonly` **\_agentConfig**: [`FullAgentConfig`](index.md#fullagentconfig)

Defined in: [chat/backends/base.ts:39](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L39)

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`_agentConfig`](#_agentconfig)

##### name

> `readonly` **name**: `string`

Defined in: [chat/backends/base.ts:35](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L35)

Backend name (e.g. "copilot", "claude", "vercel-ai")

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`name`](#name)

#### Accessors

##### agentService

###### Get Signature

> **get** **agentService**(): [`IAgentService`](index.md#iagentservice)

Defined in: [chat/backends/base.ts:64](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L64)

###### Returns

[`IAgentService`](index.md#iagentservice)

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`agentService`](#agentservice-1)

##### currentModel

###### Get Signature

> **get** **currentModel**(): `string` \| `undefined`

Defined in: [chat/backends/base.ts:78](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L78)

Current effective model

###### Returns

`string` \| `undefined`

Current effective model

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`currentModel`](#currentmodel)

#### Methods

##### assertNotDisposed()

> `protected` **assertNotDisposed**(): `void`

Defined in: [chat/backends/base.ts:243](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L243)

###### Returns

`void`

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`assertNotDisposed`](#assertnotdisposed)

##### captureSessionId()

> `protected` **captureSessionId**(`_agent`): `void`

Defined in: [chat/backends/vercel-ai.ts:48](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/vercel-ai.ts#L48)

Subclasses capture backend session ID from agent after streaming

###### Parameters

###### \_agent

[`IAgent`](index.md#iagent)

###### Returns

`void`

###### Overrides

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`captureSessionId`](#capturesessionid)

##### createService()

> `protected` **createService**(): [`IAgentService`](index.md#iagentservice)

Defined in: [chat/backends/vercel-ai.ts:41](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/vercel-ai.ts#L41)

Subclasses create their specific IAgentService

###### Returns

[`IAgentService`](index.md#iagentservice)

###### Overrides

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`createService`](#createservice)

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [chat/backends/base.ts:196](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L196)

Dispose resources

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`dispose`](#dispose)

##### getOrCreateAgent()

> `protected` **getOrCreateAgent**(`options?`): [`IAgent`](index.md#iagent)

Defined in: [chat/backends/base.ts:211](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L211)

Get or create an agent. Model is passed per-call via RunOptions.
 Tools are passed per-call via SendMessageOptions — not baked into config.
 For persistent sessions, reuses agent when model matches.

###### Parameters

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

[`IAgent`](index.md#iagent)

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`getOrCreateAgent`](#getorcreateagent)

##### listModels()

> **listModels**(): `Promise`\<[`ModelInfo`](index.md#modelinfo)[]\>

Defined in: [chat/backends/base.ts:186](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L186)

List available models

###### Returns

`Promise`\<[`ModelInfo`](index.md#modelinfo)[]\>

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`listModels`](#listmodels)

##### sendMessage()

> **sendMessage**(`session`, `message`, `options?`): `Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\>\>

Defined in: [chat/backends/base.ts:90](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L90)

Send a message and receive a complete response

###### Parameters

###### session

[`ChatSession`](#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\>\>

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`sendMessage`](#sendmessage)

##### ~~setTools()~~

> **setTools**(): `void`

Defined in: [chat/backends/base.ts:86](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L86)

###### Returns

`void`

###### Deprecated

No-op. Tools are passed per-call via SendMessageOptions.tools.
Kept for backward compatibility with code that calls setTools() directly.

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`setTools`](#settools)

##### streamAgentEvents()

> `protected` **streamAgentEvents**(`agent`, `messages`, `options?`): `AsyncIterable`\<[`ChatEvent`](#chatevent)\>

Defined in: [chat/backends/base.ts:144](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L144)

Shared streaming helper: bridges agent events to chat events.
Used by both streamMessage() and resume() to avoid duplication.

###### Parameters

###### agent

[`IAgent`](index.md#iagent)

###### messages

[`Message`](index.md#message)[]

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](#chatevent)\>

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`streamAgentEvents`](#streamagentevents)

##### streamMessage()

> **streamMessage**(`session`, `message`, `options?`): `AsyncIterable`\<[`ChatEvent`](#chatevent)\>

Defined in: [chat/backends/base.ts:124](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L124)

Stream a message response as ChatEvents

###### Parameters

###### session

[`ChatSession`](#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](#chatevent)\>

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`streamMessage`](#streammessage)

##### validate()

> **validate**(): `Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

Defined in: [chat/backends/base.ts:191](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/base.ts#L191)

Validate backend configuration/credentials

###### Returns

`Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

###### Inherited from

[`BaseBackendAdapter`](#abstract-basebackendadapter).[`validate`](#validate)

***

### WsChatTransport

Defined in: [chat/backends/ws-transport.ts:47](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/ws-transport.ts#L47)

WebSocket transport for ChatEvent streaming.
Sends events as JSON messages over a WebSocket connection.

#### Implements

- [`IChatTransport`](#ichattransport)

#### Constructors

##### Constructor

> **new WsChatTransport**(`ws`, `options?`): [`WsChatTransport`](#wschattransport)

Defined in: [chat/backends/ws-transport.ts:53](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/ws-transport.ts#L53)

###### Parameters

###### ws

[`WebSocketLike`](chat/backends.md#websocketlike)

###### options?

[`WsTransportOptions`](chat/backends.md#wstransportoptions)

###### Returns

[`WsChatTransport`](#wschattransport)

#### Accessors

##### isOpen

###### Get Signature

> **get** **isOpen**(): `boolean`

Defined in: [chat/backends/ws-transport.ts:78](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/ws-transport.ts#L78)

Whether the transport is still open

###### Returns

`boolean`

Whether the transport is still open

###### Implementation of

[`IChatTransport`](#ichattransport).[`isOpen`](#isopen)

#### Methods

##### close()

> **close**(): `void`

Defined in: [chat/backends/ws-transport.ts:87](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/ws-transport.ts#L87)

Signal stream completion and close the connection

###### Returns

`void`

###### Implementation of

[`IChatTransport`](#ichattransport).[`close`](#close)

##### error()

> **error**(`err`): `void`

Defined in: [chat/backends/ws-transport.ts:96](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/ws-transport.ts#L96)

Signal an error to the client

###### Parameters

###### err

`Error`

###### Returns

`void`

###### Implementation of

[`IChatTransport`](#ichattransport).[`error`](#error)

##### send()

> **send**(`event`): `void`

Defined in: [chat/backends/ws-transport.ts:82](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/ws-transport.ts#L82)

Send a single chat event to the client

###### Parameters

###### event

[`ChatEvent`](#chatevent)

###### Returns

`void`

###### Implementation of

[`IChatTransport`](#ichattransport).[`send`](#send)

## Interfaces

### BackendAdapterOptions

Defined in: [chat/backends/types.ts:23](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L23)

Options for creating a backend adapter

#### Extended by

- [`CopilotChatAdapterOptions`](chat/backends.md#copilotchatadapteroptions)
- [`ClaudeChatAdapterOptions`](chat/backends.md#claudechatadapteroptions)
- [`VercelAIChatAdapterOptions`](chat/backends.md#vercelaichatadapteroptions)
- [`MockLLMChatAdapterOptions`](chat/backends.md#mockllmchatadapteroptions)

#### Properties

##### agentConfig

> **agentConfig**: [`FullAgentConfig`](index.md#fullagentconfig)

Defined in: [chat/backends/types.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L25)

Agent configuration (model, systemPrompt, tools, etc.)

##### agentService?

> `optional` **agentService**: [`IAgentService`](index.md#iagentservice)

Defined in: [chat/backends/types.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L27)

Pre-created agent service (if adapter should not own lifecycle)

##### agentServiceFactory()?

> `optional` **agentServiceFactory**: () => [`IAgentService`](index.md#iagentservice)

Defined in: [chat/backends/types.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L29)

Factory for lazy service creation (called on first use, not at construction)

###### Returns

[`IAgentService`](index.md#iagentservice)

***

### ChatMessage

Defined in: [chat/types.ts:95](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L95)

A single chat message — the fundamental unit of conversation

#### Type Parameters

##### TMetadata

`TMetadata` = `unknown`

#### Properties

##### createdAt

> **createdAt**: `string`

Defined in: [chat/types.ts:100](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L100)

##### id

> **id**: [`ChatId`](#chatid)

Defined in: [chat/types.ts:96](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L96)

##### metadata?

> `optional` **metadata**: `TMetadata`

Defined in: [chat/types.ts:99](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L99)

##### parts

> **parts**: [`MessagePart`](#messagepart)[]

Defined in: [chat/types.ts:98](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L98)

##### role

> **role**: [`ChatRole`](#chatrole)

Defined in: [chat/types.ts:97](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L97)

##### status

> **status**: [`MessageStatus`](#messagestatus)

Defined in: [chat/types.ts:102](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L102)

##### updatedAt?

> `optional` **updatedAt**: `string`

Defined in: [chat/types.ts:101](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L101)

***

### ChatMessageMetadata

Defined in: [chat/types.ts:82](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L82)

Metadata attached to messages — useful preset for the TMetadata generic

#### Properties

##### backend?

> `optional` **backend**: `string`

Defined in: [chat/types.ts:84](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L84)

##### custom?

> `optional` **custom**: `Record`\<`string`, `unknown`\>

Defined in: [chat/types.ts:88](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L88)

##### estimatedTokens?

> `optional` **estimatedTokens**: `number`

Defined in: [chat/types.ts:87](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L87)

##### isSummary?

> `optional` **isSummary**: `boolean`

Defined in: [chat/types.ts:86](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L86)

##### model?

> `optional` **model**: `string`

Defined in: [chat/types.ts:83](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L83)

##### usage?

> `optional` **usage**: [`UsageData`](index.md#usagedata)

Defined in: [chat/types.ts:85](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L85)

***

### ChatMiddleware

Defined in: [chat/types.ts:247](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L247)

Runtime-level middleware for the send/receive lifecycle.
 Different from EventMiddleware which operates at the event bus level.

#### Methods

##### onAfterReceive()?

> `optional` **onAfterReceive**(`message`, `context`): [`ChatMessage`](#chatmessage)\<`unknown`\> \| `Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\>\>

Defined in: [chat/types.ts:253](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L253)

Transform completed message after receiving from backend

###### Parameters

###### message

[`ChatMessage`](#chatmessage)

###### context

[`ChatMiddlewareContext`](#chatmiddlewarecontext)

###### Returns

[`ChatMessage`](#chatmessage)\<`unknown`\> \| `Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\>\>

##### onBeforeSend()?

> `optional` **onBeforeSend**(`message`, `context`): [`ChatMessage`](#chatmessage)\<`unknown`\> \| `Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\> \| `null`\> \| `null`

Defined in: [chat/types.ts:249](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L249)

Transform message before sending to backend. Return null to reject the send.

###### Parameters

###### message

[`ChatMessage`](#chatmessage)

###### context

[`ChatMiddlewareContext`](#chatmiddlewarecontext)

###### Returns

[`ChatMessage`](#chatmessage)\<`unknown`\> \| `Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\> \| `null`\> \| `null`

##### onError()?

> `optional` **onError**(`error`, `context`): `Error` \| `Promise`\<`Error` \| `null`\> \| `null`

Defined in: [chat/types.ts:255](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L255)

Intercept errors — return null to suppress, return error to propagate

###### Parameters

###### error

`Error`

###### context

[`ChatMiddlewareContext`](#chatmiddlewarecontext)

###### Returns

`Error` \| `Promise`\<`Error` \| `null`\> \| `null`

##### onEvent()?

> `optional` **onEvent**(`event`, `context`): [`ChatEvent`](#chatevent) \| `Promise`\<ChatEvent \| null\> \| `null`

Defined in: [chat/types.ts:251](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L251)

Transform/intercept stream events

###### Parameters

###### event

[`ChatEvent`](#chatevent)

###### context

[`ChatMiddlewareContext`](#chatmiddlewarecontext)

###### Returns

[`ChatEvent`](#chatevent) \| `Promise`\<ChatEvent \| null\> \| `null`

***

### ChatMiddlewareContext

Defined in: [chat/types.ts:240](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L240)

Context passed to ChatMiddleware hooks

#### Properties

##### sessionId

> **sessionId**: [`ChatId`](#chatid)

Defined in: [chat/types.ts:241](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L241)

##### signal

> **signal**: `AbortSignal`

Defined in: [chat/types.ts:242](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L242)

***

### ChatSession

Defined in: [chat/types.ts:139](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L139)

Chat session — a conversation with ordered messages (pure serializable data)

#### Extended by

- [`ObservableSession`](#observablesession)

#### Type Parameters

##### TCustom

`TCustom` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Properties

##### backendSessionId?

> `optional` **backendSessionId**: `string`

Defined in: [chat/types.ts:148](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L148)

##### config

> **config**: [`ChatSessionConfig`](#chatsessionconfig-1)

Defined in: [chat/types.ts:143](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L143)

##### createdAt

> **createdAt**: `string`

Defined in: [chat/types.ts:146](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L146)

##### id

> **id**: [`ChatId`](#chatid)

Defined in: [chat/types.ts:140](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L140)

##### messages

> **messages**: [`ChatMessage`](#chatmessage)\<`unknown`\>[]

Defined in: [chat/types.ts:142](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L142)

##### metadata

> **metadata**: [`ChatSessionMetadata`](chat/core.md#chatsessionmetadata)\<`TCustom`\>

Defined in: [chat/types.ts:144](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L144)

##### status

> **status**: `"active"`

Defined in: [chat/types.ts:145](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L145)

##### title?

> `optional` **title**: `string`

Defined in: [chat/types.ts:141](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L141)

##### updatedAt

> **updatedAt**: `string`

Defined in: [chat/types.ts:147](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L147)

***

### ChatSessionConfig

Defined in: [chat/types.ts:110](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L110)

Session configuration snapshot

#### Properties

##### backend

> **backend**: `string`

Defined in: [chat/types.ts:112](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L112)

##### maxTokens?

> `optional` **maxTokens**: `number`

Defined in: [chat/types.ts:115](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L115)

##### model

> **model**: `string`

Defined in: [chat/types.ts:111](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L111)

##### systemPrompt?

> `optional` **systemPrompt**: `string`

Defined in: [chat/types.ts:113](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L113)

##### temperature?

> `optional` **temperature**: `number`

Defined in: [chat/types.ts:114](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L114)

***

### FilePart

Defined in: [chat/types.ts:72](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L72)

File attachment part (base64-encoded data)

#### Properties

##### data

> **data**: `string`

Defined in: [chat/types.ts:72](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L72)

##### mimeType

> **mimeType**: `string`

Defined in: [chat/types.ts:72](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L72)

##### name

> **name**: `string`

Defined in: [chat/types.ts:72](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L72)

##### status

> **status**: [`PartStatus`](#partstatus)

Defined in: [chat/types.ts:72](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L72)

##### type

> **type**: `"file"`

Defined in: [chat/types.ts:72](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L72)

***

### IChatBackend

Defined in: [chat/backends/types.ts:42](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L42)

Core chat backend — send, stream, models, validate, dispose.
All backends implement this. Resume support is optional.

Note: `agentService` is intentionally NOT on this interface.
It's an implementation detail exposed on BaseBackendAdapter for
advanced consumers who need direct service access.

#### Extended by

- [`IResumableBackend`](#iresumablebackend)

#### Properties

##### currentModel

> `readonly` **currentModel**: `string` \| `undefined`

Defined in: [chat/backends/types.ts:70](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L70)

Current effective model

##### name

> `readonly` **name**: `string`

Defined in: [chat/backends/types.ts:44](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L44)

Backend name (e.g. "copilot", "claude", "vercel-ai")

#### Methods

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [chat/backends/types.ts:67](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L67)

Dispose resources

###### Returns

`Promise`\<`void`\>

##### listModels()

> **listModels**(): `Promise`\<[`ModelInfo`](index.md#modelinfo)[]\>

Defined in: [chat/backends/types.ts:61](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L61)

List available models

###### Returns

`Promise`\<[`ModelInfo`](index.md#modelinfo)[]\>

##### sendMessage()

> **sendMessage**(`session`, `message`, `options?`): `Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\>\>

Defined in: [chat/backends/types.ts:47](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L47)

Send a message and receive a complete response

###### Parameters

###### session

[`ChatSession`](#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\>\>

##### streamMessage()

> **streamMessage**(`session`, `message`, `options?`): `AsyncIterable`\<[`ChatEvent`](#chatevent)\>

Defined in: [chat/backends/types.ts:54](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L54)

Stream a message response as ChatEvents

###### Parameters

###### session

[`ChatSession`](#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](#chatevent)\>

##### validate()

> **validate**(): `Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

Defined in: [chat/backends/types.ts:64](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L64)

Validate backend configuration/credentials

###### Returns

`Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

***

### IChatTransport

Defined in: [chat/backends/transport.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L16)

Abstraction for delivering chat events to a client.
Implementations handle protocol details (SSE, WebSocket, etc.).

#### Properties

##### isOpen

> `readonly` **isOpen**: `boolean`

Defined in: [chat/backends/transport.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L27)

Whether the transport is still open

#### Methods

##### close()

> **close**(): `void`

Defined in: [chat/backends/transport.ts:21](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L21)

Signal stream completion and close the connection

###### Returns

`void`

##### error()

> **error**(`err`): `void`

Defined in: [chat/backends/transport.ts:24](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L24)

Signal an error to the client

###### Parameters

###### err

`Error`

###### Returns

`void`

##### send()

> **send**(`event`): `void`

Defined in: [chat/backends/transport.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L18)

Send a single chat event to the client

###### Parameters

###### event

[`ChatEvent`](#chatevent)

###### Returns

`void`

***

### IProviderStore

Defined in: [chat/provider-types.ts:30](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/provider-types.ts#L30)

Provider storage interface for server-side provider management

#### Methods

##### create()

> **create**(`config`): `Promise`\<`void`\>

Defined in: [chat/provider-types.ts:32](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/provider-types.ts#L32)

Create a new provider. Generates UUID if id not set on config.

###### Parameters

###### config

[`ProviderConfig`](#providerconfig)

###### Returns

`Promise`\<`void`\>

##### delete()

> **delete**(`id`): `Promise`\<`void`\>

Defined in: [chat/provider-types.ts:38](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/provider-types.ts#L38)

Delete a provider by id.

###### Parameters

###### id

`string`

###### Returns

`Promise`\<`void`\>

##### dispose()?

> `optional` **dispose**(): `Promise`\<`void`\>

Defined in: [chat/provider-types.ts:42](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/provider-types.ts#L42)

Release any resources held by this store (optional).

###### Returns

`Promise`\<`void`\>

##### get()

> **get**(`id`): `Promise`\<[`ProviderConfig`](#providerconfig) \| `null`\>

Defined in: [chat/provider-types.ts:34](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/provider-types.ts#L34)

Get a provider by id. Returns null if not found.

###### Parameters

###### id

`string`

###### Returns

`Promise`\<[`ProviderConfig`](#providerconfig) \| `null`\>

##### list()

> **list**(): `Promise`\<[`ProviderConfig`](#providerconfig)[]\>

Defined in: [chat/provider-types.ts:40](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/provider-types.ts#L40)

List all providers.

###### Returns

`Promise`\<[`ProviderConfig`](#providerconfig)[]\>

##### update()

> **update**(`id`, `changes`): `Promise`\<`void`\>

Defined in: [chat/provider-types.ts:36](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/provider-types.ts#L36)

Update an existing provider. Throws if not found.

###### Parameters

###### id

`string`

###### changes

`Partial`\<`Omit`\<[`ProviderConfig`](#providerconfig), `"id"` \| `"createdAt"`\>\>

###### Returns

`Promise`\<`void`\>

***

### IResumableBackend

Defined in: [chat/backends/types.ts:80](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L80)

Extended backend with session resume capabilities.
Only backends with persistent sessions (Copilot, Claude) implement this.
Use `isResumableBackend()` to type-narrow at runtime.

#### Extends

- [`IChatBackend`](#ichatbackend)

#### Properties

##### backendSessionId

> `readonly` **backendSessionId**: `string` \| `null`

Defined in: [chat/backends/types.ts:97](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L97)

The backend session ID from the last stream, or null if not yet streamed

##### currentModel

> `readonly` **currentModel**: `string` \| `undefined`

Defined in: [chat/backends/types.ts:70](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L70)

Current effective model

###### Inherited from

[`IChatBackend`](#ichatbackend).[`currentModel`](#currentmodel-3)

##### name

> `readonly` **name**: `string`

Defined in: [chat/backends/types.ts:44](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L44)

Backend name (e.g. "copilot", "claude", "vercel-ai")

###### Inherited from

[`IChatBackend`](#ichatbackend).[`name`](#name-4)

#### Methods

##### canResume()

> **canResume**(): `boolean`

Defined in: [chat/backends/types.ts:82](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L82)

Whether this adapter supports session resume

###### Returns

`boolean`

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [chat/backends/types.ts:67](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L67)

Dispose resources

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`IChatBackend`](#ichatbackend).[`dispose`](#dispose-3)

##### listModels()

> **listModels**(): `Promise`\<[`ModelInfo`](index.md#modelinfo)[]\>

Defined in: [chat/backends/types.ts:61](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L61)

List available models

###### Returns

`Promise`\<[`ModelInfo`](index.md#modelinfo)[]\>

###### Inherited from

[`IChatBackend`](#ichatbackend).[`listModels`](#listmodels-3)

##### resume()

> **resume**(`session`, `backendSessionId`, `options?`): `AsyncIterable`\<[`ChatEvent`](#chatevent)\>

Defined in: [chat/backends/types.ts:90](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L90)

Resume a previous session by its backend session ID.
Streams events from the resumed session.

###### Parameters

###### session

[`ChatSession`](#chatsession)

###### backendSessionId

`string`

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](#chatevent)\>

###### Throws

ChatError with SESSION_EXPIRED if session is no longer valid

###### Throws

ChatError with SESSION_NOT_FOUND if session ID is unknown

##### sendMessage()

> **sendMessage**(`session`, `message`, `options?`): `Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\>\>

Defined in: [chat/backends/types.ts:47](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L47)

Send a message and receive a complete response

###### Parameters

###### session

[`ChatSession`](#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`Promise`\<[`ChatMessage`](#chatmessage)\<`unknown`\>\>

###### Inherited from

[`IChatBackend`](#ichatbackend).[`sendMessage`](#sendmessage-3)

##### streamMessage()

> **streamMessage**(`session`, `message`, `options?`): `AsyncIterable`\<[`ChatEvent`](#chatevent)\>

Defined in: [chat/backends/types.ts:54](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L54)

Stream a message response as ChatEvents

###### Parameters

###### session

[`ChatSession`](#chatsession)

###### message

`string`

###### options?

[`SendMessageOptions`](#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](#chatevent)\>

###### Inherited from

[`IChatBackend`](#ichatbackend).[`streamMessage`](#streammessage-3)

##### validate()

> **validate**(): `Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

Defined in: [chat/backends/types.ts:64](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L64)

Validate backend configuration/credentials

###### Returns

`Promise`\<\{ `errors`: `string`[]; `valid`: `boolean`; \}\>

###### Inherited from

[`IChatBackend`](#ichatbackend).[`validate`](#validate-3)

***

### ObservableSession

Defined in: [chat/types.ts:156](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L156)

Reactive wrapper around ChatSession — provides subscribe/getSnapshot for
React useSyncExternalStore integration and lastMessage convenience getter.
Session stores may optionally return ObservableSession instances.

#### Extends

- [`ChatSession`](#chatsession)\<`TCustom`\>

#### Type Parameters

##### TCustom

`TCustom` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Properties

##### backendSessionId?

> `optional` **backendSessionId**: `string`

Defined in: [chat/types.ts:148](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L148)

###### Inherited from

[`ChatSession`](#chatsession).[`backendSessionId`](#backendsessionid)

##### config

> **config**: [`ChatSessionConfig`](#chatsessionconfig-1)

Defined in: [chat/types.ts:143](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L143)

###### Inherited from

[`ChatSession`](#chatsession).[`config`](#config)

##### createdAt

> **createdAt**: `string`

Defined in: [chat/types.ts:146](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L146)

###### Inherited from

[`ChatSession`](#chatsession).[`createdAt`](#createdat-1)

##### id

> **id**: [`ChatId`](#chatid)

Defined in: [chat/types.ts:140](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L140)

###### Inherited from

[`ChatSession`](#chatsession).[`id`](#id-1)

##### lastMessage

> `readonly` **lastMessage**: [`ChatMessage`](#chatmessage)\<`unknown`\> \| `undefined`

Defined in: [chat/types.ts:163](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L163)

Last message in the session

##### messages

> **messages**: [`ChatMessage`](#chatmessage)\<`unknown`\>[]

Defined in: [chat/types.ts:142](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L142)

###### Inherited from

[`ChatSession`](#chatsession).[`messages`](#messages)

##### metadata

> **metadata**: [`ChatSessionMetadata`](chat/core.md#chatsessionmetadata)\<`TCustom`\>

Defined in: [chat/types.ts:144](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L144)

###### Inherited from

[`ChatSession`](#chatsession).[`metadata`](#metadata-1)

##### status

> **status**: `"active"`

Defined in: [chat/types.ts:145](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L145)

###### Inherited from

[`ChatSession`](#chatsession).[`status`](#status-1)

##### title?

> `optional` **title**: `string`

Defined in: [chat/types.ts:141](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L141)

###### Inherited from

[`ChatSession`](#chatsession).[`title`](#title)

##### updatedAt

> **updatedAt**: `string`

Defined in: [chat/types.ts:147](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L147)

###### Inherited from

[`ChatSession`](#chatsession).[`updatedAt`](#updatedat-1)

#### Methods

##### getSnapshot()

> **getSnapshot**(): [`ChatSession`](#chatsession)\<`TCustom`\>

Defined in: [chat/types.ts:161](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L161)

Get immutable snapshot of session state (for React useSyncExternalStore)

###### Returns

[`ChatSession`](#chatsession)\<`TCustom`\>

##### subscribe()

> **subscribe**(`callback`): () => `void`

Defined in: [chat/types.ts:159](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L159)

Subscribe to session changes (for React useSyncExternalStore)

###### Parameters

###### callback

() => `void`

###### Returns

> (): `void`

###### Returns

`void`

***

### ProviderConfig

Defined in: [chat/provider-types.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/provider-types.ts#L14)

A user-configured provider combining backend + model + label

#### Properties

##### backend

> **backend**: `string`

Defined in: [chat/provider-types.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/provider-types.ts#L18)

Backend name (copilot, claude, vercel-ai)

##### createdAt

> **createdAt**: `number`

Defined in: [chat/provider-types.ts:24](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/provider-types.ts#L24)

Creation timestamp (Date.now())

##### id

> **id**: `string`

Defined in: [chat/provider-types.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/provider-types.ts#L16)

Unique identifier (UUID or slug)

##### label

> **label**: `string`

Defined in: [chat/provider-types.ts:22](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/provider-types.ts#L22)

User-facing display name

##### model

> **model**: `string`

Defined in: [chat/provider-types.ts:20](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/provider-types.ts#L20)

Model identifier

***

### ReasoningPart

Defined in: [chat/types.ts:66](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L66)

Model reasoning/thinking content part

#### Properties

##### status

> **status**: [`PartStatus`](#partstatus)

Defined in: [chat/types.ts:66](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L66)

##### text

> **text**: `string`

Defined in: [chat/types.ts:66](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L66)

##### type

> **type**: `"reasoning"`

Defined in: [chat/types.ts:66](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L66)

***

### RuntimeSendOptions

Defined in: [chat/types.ts:273](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L273)

Options for runtime.send() — requires backend routing info

#### Properties

##### backend

> **backend**: `string`

Defined in: [chat/types.ts:275](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L275)

Backend to route this request to (key in backends map)

##### context?

> `optional` **context**: `Record`\<`string`, `unknown`\>

Defined in: [chat/types.ts:285](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L285)

Request-scoped context

##### credentials

> **credentials**: [`AuthToken`](auth.md#authtoken)

Defined in: [chat/types.ts:277](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L277)

Authentication credentials for the backend factory

##### model

> **model**: `string`

Defined in: [chat/types.ts:279](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L279)

Model to use for this request

##### signal?

> `optional` **signal**: `AbortSignal`

Defined in: [chat/types.ts:283](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L283)

Abort signal

##### systemPrompt?

> `optional` **systemPrompt**: `string`

Defined in: [chat/types.ts:281](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L281)

Per-call system prompt override (forwarded to the backend agent)

##### tools?

> `optional` **tools**: [`ToolDefinition`](index.md#tooldefinition)\<`unknown`\>[]

Defined in: [chat/types.ts:287](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L287)

Additional tools

***

### SendMessageOptions

Defined in: [chat/types.ts:261](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L261)

Options for sending a message to a provider

#### Properties

##### context?

> `optional` **context**: `Record`\<`string`, `unknown`\>

Defined in: [chat/types.ts:267](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L267)

##### model?

> `optional` **model**: `string`

Defined in: [chat/types.ts:264](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L264)

Model to use for this request. Required for server-side runtime.send().

##### signal?

> `optional` **signal**: `AbortSignal`

Defined in: [chat/types.ts:262](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L262)

##### systemPrompt?

> `optional` **systemPrompt**: `string`

Defined in: [chat/types.ts:266](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L266)

Per-call system prompt override (forwarded to the backend agent)

##### tools?

> `optional` **tools**: [`ToolDefinition`](index.md#tooldefinition)\<`unknown`\>[]

Defined in: [chat/types.ts:269](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L269)

Additional tools to include in this request

***

### SessionInfo

Defined in: [chat/types.ts:167](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L167)

Lightweight session info for listing (without full message array)

#### Properties

##### createdAt

> **createdAt**: `string`

Defined in: [chat/types.ts:173](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L173)

##### id

> **id**: [`ChatId`](#chatid)

Defined in: [chat/types.ts:168](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L168)

##### lastMessage?

> `optional` **lastMessage**: [`ChatMessage`](#chatmessage)\<`unknown`\>

Defined in: [chat/types.ts:172](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L172)

##### messageCount

> **messageCount**: `number`

Defined in: [chat/types.ts:171](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L171)

##### status

> **status**: `"active"`

Defined in: [chat/types.ts:170](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L170)

##### title?

> `optional` **title**: `string`

Defined in: [chat/types.ts:169](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L169)

##### updatedAt

> **updatedAt**: `string`

Defined in: [chat/types.ts:174](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L174)

***

### SourcePart

Defined in: [chat/types.ts:70](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L70)

Source reference part (URL citation)

#### Properties

##### status

> **status**: [`PartStatus`](#partstatus)

Defined in: [chat/types.ts:70](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L70)

##### title?

> `optional` **title**: `string`

Defined in: [chat/types.ts:70](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L70)

##### type

> **type**: `"source"`

Defined in: [chat/types.ts:70](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L70)

##### url

> **url**: `string`

Defined in: [chat/types.ts:70](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L70)

***

### StreamWatchdogConfig

Defined in: [chat/watchdog.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/watchdog.ts#L14)

Stream watchdog configuration

#### Properties

##### signal?

> `optional` **signal**: `AbortSignal`

Defined in: [chat/watchdog.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/watchdog.ts#L18)

AbortSignal to link with (watchdog aborts when this signal fires)

##### timeoutMs

> **timeoutMs**: `number`

Defined in: [chat/watchdog.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/watchdog.ts#L16)

Maximum inactivity time in milliseconds before aborting the stream

***

### TextPart

Defined in: [chat/types.ts:64](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L64)

Plain text content part

#### Properties

##### status

> **status**: [`PartStatus`](#partstatus)

Defined in: [chat/types.ts:64](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L64)

##### text

> **text**: `string`

Defined in: [chat/types.ts:64](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L64)

##### type

> **type**: `"text"`

Defined in: [chat/types.ts:64](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L64)

***

### ToolCallPart

Defined in: [chat/types.ts:68](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L68)

Tool invocation part with call ID, arguments, optional result

#### Properties

##### args

> **args**: `unknown`

Defined in: [chat/types.ts:68](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L68)

##### error?

> `optional` **error**: `string`

Defined in: [chat/types.ts:68](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L68)

##### name

> **name**: `string`

Defined in: [chat/types.ts:68](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L68)

##### result?

> `optional` **result**: `unknown`

Defined in: [chat/types.ts:68](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L68)

##### status

> **status**: [`ToolCallStatus`](#toolcallstatus)

Defined in: [chat/types.ts:68](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L68)

##### toolCallId

> **toolCallId**: `string`

Defined in: [chat/types.ts:68](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L68)

##### type

> **type**: `"tool_call"`

Defined in: [chat/types.ts:68](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L68)

## Type Aliases

### ChatEvent

> **ChatEvent** = \{ `messageId`: [`ChatId`](#chatid); `role`: [`ChatRole`](#chatrole); `type`: `"message:start"`; \} \| \{ `messageId`: [`ChatId`](#chatid); `text`: `string`; `type`: `"message:delta"`; \} \| \{ `message`: [`ChatMessage`](#chatmessage); `messageId`: [`ChatId`](#chatid); `type`: `"message:complete"`; \} \| \{ `args`: `Record`\<`string`, `unknown`\>; `messageId`: [`ChatId`](#chatid); `toolCallId`: `string`; `toolName`: `string`; `type`: `"tool:start"`; \} \| \{ `isError?`: `boolean`; `messageId`: [`ChatId`](#chatid); `result`: `unknown`; `toolCallId`: `string`; `toolName`: `string`; `type`: `"tool:complete"`; \} \| \{ `messageId`: [`ChatId`](#chatid); `type`: `"thinking:start"`; \} \| \{ `messageId`: [`ChatId`](#chatid); `text`: `string`; `type`: `"thinking:delta"`; \} \| \{ `messageId`: [`ChatId`](#chatid); `type`: `"thinking:end"`; \} \| \{ `messageId`: [`ChatId`](#chatid); `toolArgs`: `Record`\<`string`, `unknown`\>; `toolName`: `string`; `type`: `"permission:request"`; \} \| \{ `allowed`: `boolean`; `messageId`: [`ChatId`](#chatid); `toolName`: `string`; `type`: `"permission:response"`; \} \| \{ `completionTokens`: `number`; `model?`: `string`; `promptTokens`: `number`; `type`: `"usage"`; \} \| \{ `sessionId`: [`ChatId`](#chatid); `type`: `"session:created"`; \} \| \{ `sessionId`: [`ChatId`](#chatid); `type`: `"session:updated"`; \} \| \{ `code?`: [`ErrorCode`](index.md#errorcode); `error`: `string`; `messageId?`: [`ChatId`](#chatid); `recoverable`: `boolean`; `type`: `"error"`; \} \| \{ `type`: `"typing:start"`; \} \| \{ `type`: `"typing:end"`; \} \| \{ `type`: `"heartbeat"`; \} \| \{ `finalOutput?`: `string`; `finishReason?`: `string`; `type`: `"done"`; \}

Defined in: [chat/types.ts:180](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L180)

Events emitted during chat operation

***

### ChatEventType

> **ChatEventType** = [`ChatEvent`](#chatevent)\[`"type"`\]

Defined in: [chat/types.ts:235](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L235)

All possible ChatEvent type strings

***

### ChatId

> **ChatId** = `string` & `object`

Defined in: [chat/types.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L14)

Branded type for unique identifiers

#### Type Declaration

##### \_\_brand

> `readonly` **\_\_brand**: `"ChatId"`

***

### ChatIdLike

> **ChatIdLike** = `string` \| [`ChatId`](#chatid)

Defined in: [chat/types.ts:46](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L46)

Accepts either a plain string or branded ChatId for API convenience.
Use this in public API signatures so consumers don't need `as ChatId` casts.

***

### ChatMessageStatus

> **ChatMessageStatus** = [`MessageStatus`](#messagestatus)

Defined in: [chat/types.ts:92](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L92)

Message status

***

### ChatRole

> **ChatRole** = `"user"` \| `"assistant"` \| `"system"`

Defined in: [chat/types.ts:79](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L79)

Role of message author

***

### ~~IChatProvider~~

> **IChatProvider** = [`IChatBackend`](#ichatbackend)

Defined in: [chat/types.ts:295](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L295)

#### Deprecated

IChatProvider has been inlined into IChatBackend.
Import IChatBackend from "@witqq/agent-sdk/chat/backends" instead.
Kept as type alias for backward compatibility.

***

### MessagePart

> **MessagePart** = [`TextPart`](#textpart) \| [`ReasoningPart`](#reasoningpart) \| [`ToolCallPart`](#toolcallpart) \| [`SourcePart`](#sourcepart) \| [`FilePart`](#filepart)

Defined in: [chat/types.ts:74](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L74)

Union of all message part types

***

### MessageStatus

> **MessageStatus** = `"pending"` \| `"streaming"` \| `"complete"` \| `"error"` \| `"cancelled"`

Defined in: [chat/types.ts:55](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L55)

Lifecycle status of an entire message

***

### PartStatus

> **PartStatus** = `"pending"` \| `"streaming"` \| `"complete"` \| `"error"`

Defined in: [chat/types.ts:51](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L51)

Lifecycle status of a message part (text, reasoning, etc.)

***

### RuntimeStatus

> **RuntimeStatus** = `"idle"` \| `"streaming"` \| `"error"` \| `"disposed"`

Defined in: [chat/types.ts:59](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L59)

Lifecycle status of the chat runtime

***

### SessionStatus

> **SessionStatus** = `"active"`

Defined in: [chat/types.ts:57](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L57)

Lifecycle status of a chat session

***

### ToolCallStatus

> **ToolCallStatus** = `"pending"` \| `"running"` \| `"requires_approval"` \| `"complete"` \| `"error"` \| `"denied"`

Defined in: [chat/types.ts:53](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L53)

Lifecycle status of a tool call within a message

## Functions

### adaptAgentEvents()

> **adaptAgentEvents**(`events`, `messageId`): `AsyncIterable`\<[`ChatEvent`](#chatevent)\>

Defined in: [chat/bridge.ts:85](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/bridge.ts#L85)

Convert AgentEvent async iterable to ChatEvent async iterable

#### Parameters

##### events

`AsyncIterable`\<[`AgentEvent`](index.md#agentevent)\>

##### messageId

[`ChatId`](#chatid)

#### Returns

`AsyncIterable`\<[`ChatEvent`](#chatevent)\>

***

### agentEventToChatEvent()

> **agentEventToChatEvent**(`event`, `messageId`): [`ChatEvent`](#chatevent) \| `null`

Defined in: [chat/bridge.ts:11](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/bridge.ts#L11)

Map a single AgentEvent to a ChatEvent (or null if no mapping)

#### Parameters

##### event

[`AgentEvent`](index.md#agentevent)

##### messageId

[`ChatId`](#chatid)

#### Returns

[`ChatEvent`](#chatevent) \| `null`

***

### createChatId()

> **createChatId**(): [`ChatId`](#chatid)

Defined in: [chat/types.ts:20](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L20)

Generate a new unique ChatId (crypto.randomUUID-based)

#### Returns

[`ChatId`](#chatid)

Branded ChatId string

***

### createTextMessage()

> **createTextMessage**(`text`, `role?`): [`ChatMessage`](#chatmessage)

Defined in: [chat/types.ts:306](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L306)

Create a simple text ChatMessage.

#### Parameters

##### text

`string`

Message text content

##### role?

[`ChatRole`](#chatrole) = `"user"`

Message role (default: "user")

#### Returns

[`ChatMessage`](#chatmessage)

A complete ChatMessage with a single TextPart

***

### fromAgentMessage()

> **fromAgentMessage**(`message`, `id?`): [`ChatMessage`](#chatmessage)

Defined in: [chat/conversion.ts:58](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/conversion.ts#L58)

Convert an agent-sdk Message to ChatMessage

#### Parameters

##### message

[`Message`](index.md#message)

##### id?

[`ChatId`](#chatid)

#### Returns

[`ChatMessage`](#chatmessage)

***

### getMessageReasoning()

> **getMessageReasoning**(`message`): `string`

Defined in: [chat/chat-utils.ts:28](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/chat-utils.ts#L28)

Join all ReasoningPart texts in a message

#### Parameters

##### message

[`ChatMessage`](#chatmessage)

#### Returns

`string`

***

### getMessageText()

> **getMessageText**(`message`): `string`

Defined in: [chat/chat-utils.ts:11](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/chat-utils.ts#L11)

Join all TextPart texts in a message

#### Parameters

##### message

[`ChatMessage`](#chatmessage)

#### Returns

`string`

***

### getMessageToolCalls()

> **getMessageToolCalls**(`message`): [`ToolCallPart`](#toolcallpart)[]

Defined in: [chat/chat-utils.ts:21](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/chat-utils.ts#L21)

Filter all ToolCallParts from a message

#### Parameters

##### message

[`ChatMessage`](#chatmessage)

#### Returns

[`ToolCallPart`](#toolcallpart)[]

***

### isChatEvent()

> **isChatEvent**(`value`): `value is ChatEvent`

Defined in: [chat/guards.ts:101](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/guards.ts#L101)

Check if a value is a ChatEvent

#### Parameters

##### value

`unknown`

#### Returns

`value is ChatEvent`

***

### isChatMessage()

> **isChatMessage**(`value`): `value is ChatMessage<unknown>`

Defined in: [chat/guards.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/guards.ts#L18)

Check if a value is a ChatMessage

#### Parameters

##### value

`unknown`

#### Returns

`value is ChatMessage<unknown>`

***

### isChatSession()

> **isChatSession**(`value`): `value is ChatSession<Record<string, unknown>>`

Defined in: [chat/guards.ts:32](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/guards.ts#L32)

Check if a value is a ChatSession

#### Parameters

##### value

`unknown`

#### Returns

`value is ChatSession<Record<string, unknown>>`

***

### isFilePart()

> **isFilePart**(`value`): `value is FilePart`

Defined in: [chat/guards.ts:85](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/guards.ts#L85)

Check if a value is a FilePart

#### Parameters

##### value

`unknown`

#### Returns

`value is FilePart`

***

### isMessagePart()

> **isMessagePart**(`value`): `value is MessagePart`

Defined in: [chat/guards.ts:47](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/guards.ts#L47)

Check if a value is a MessagePart

#### Parameters

##### value

`unknown`

#### Returns

`value is MessagePart`

***

### isObservableSession()

> **isObservableSession**\<`TCustom`\>(`session`): `session is ObservableSession<TCustom>`

Defined in: [chat/types.ts:317](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L317)

Type guard: checks if a session has reactive API (subscribe/getSnapshot)

#### Type Parameters

##### TCustom

`TCustom` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Parameters

##### session

[`ChatSession`](#chatsession)\<`TCustom`\>

#### Returns

`session is ObservableSession<TCustom>`

***

### isReasoningPart()

> **isReasoningPart**(`value`): `value is ReasoningPart`

Defined in: [chat/guards.ts:71](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/guards.ts#L71)

Check if a value is a ReasoningPart

#### Parameters

##### value

`unknown`

#### Returns

`value is ReasoningPart`

***

### isResumableBackend()

> **isResumableBackend**(`adapter`): `adapter is IResumableBackend`

Defined in: [chat/backends/types.ts:101](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/types.ts#L101)

Type guard: checks if a backend adapter supports session resume

#### Parameters

##### adapter

[`IChatBackend`](#ichatbackend)

#### Returns

`adapter is IResumableBackend`

***

### isSourcePart()

> **isSourcePart**(`value`): `value is SourcePart`

Defined in: [chat/guards.ts:78](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/guards.ts#L78)

Check if a value is a SourcePart

#### Parameters

##### value

`unknown`

#### Returns

`value is SourcePart`

***

### isTextPart()

> **isTextPart**(`value`): `value is TextPart`

Defined in: [chat/guards.ts:57](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/guards.ts#L57)

Check if a value is a TextPart

#### Parameters

##### value

`unknown`

#### Returns

`value is TextPart`

***

### isToolCallPart()

> **isToolCallPart**(`value`): `value is ToolCallPart`

Defined in: [chat/guards.ts:64](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/guards.ts#L64)

Check if a value is a ToolCallPart

#### Parameters

##### value

`unknown`

#### Returns

`value is ToolCallPart`

***

### streamToTransport()

> **streamToTransport**(`events`, `transport`): `Promise`\<`void`\>

Defined in: [chat/backends/transport.ts:146](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/backends/transport.ts#L146)

Pipes an async iterable of ChatEvents into a transport.
Handles errors and ensures transport is closed on completion.

#### Parameters

##### events

`AsyncIterable`\<[`ChatEvent`](#chatevent)\>

Async iterable of ChatEvent (from adapter.streamMessage)

##### transport

[`IChatTransport`](#ichattransport)

Transport to send events through

#### Returns

`Promise`\<`void`\>

***

### ~~toAgentMessage()~~

> **toAgentMessage**(`message`): [`Message`](index.md#message)

Defined in: [chat/conversion.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/conversion.ts#L14)

Convert a ChatMessage to agent-sdk Message format.

#### Parameters

##### message

[`ChatMessage`](#chatmessage)

#### Returns

[`Message`](index.md#message)

#### Deprecated

Use toAgentMessages() which correctly handles tool results.
This function drops tool results for assistant messages with completed tool calls.

***

### toAgentMessages()

> **toAgentMessages**(`message`): [`Message`](index.md#message)[]

Defined in: [chat/conversion.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/conversion.ts#L25)

Convert a ChatMessage to one or more agent-sdk Messages.
For assistant messages with completed tool calls, emits both:
1. {role: "assistant", toolCalls: [...]} — the tool invocation
2. {role: "tool", toolResults: [...]} — the tool results
This preserves tool results when replaying conversation history to backends.

#### Parameters

##### message

[`ChatMessage`](#chatmessage)

#### Returns

[`Message`](index.md#message)[]

***

### toChatId()

> **toChatId**(`value`): [`ChatId`](#chatid)

Defined in: [chat/types.ts:35](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L35)

Cast a string to ChatId with UUID format validation.
Use this instead of manual `as ChatId` type assertions.

#### Parameters

##### value

`string`

String to validate and cast

#### Returns

[`ChatId`](#chatid)

Branded ChatId

#### Throws

If value is not a valid UUID v4 format

***

### withStreamWatchdog()

> **withStreamWatchdog**\<`T`\>(`source`, `config`): `AsyncGenerator`\<`T`\>

Defined in: [chat/watchdog.ts:43](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/watchdog.ts#L43)

Wraps an async iterable with an activity timeout.
If no event arrives within `timeoutMs`, the stream is aborted with a ChatError.
The timer resets after each received event.

Uses Promise.race() so even if the source iterator is stuck on an
unresolvable promise, the timeout fires and aborts iteration.

#### Type Parameters

##### T

`T`

#### Parameters

##### source

`AsyncIterable`\<`T`\>

##### config

[`StreamWatchdogConfig`](#streamwatchdogconfig)

#### Returns

`AsyncGenerator`\<`T`\>

#### Example

```ts
const watched = withStreamWatchdog(adapter.streamMessage(session, msg), {
  timeoutMs: 30000,
  signal: abortController.signal,
});

for await (const event of watched) {
  // Each event resets the 30s inactivity timer
}
```

## References

### BackendAdapterFactory

Re-exports [BackendAdapterFactory](chat/runtime.md#backendadapterfactory)

***

### BackendInfo

Re-exports [BackendInfo](chat/runtime.md#backendinfo)

***

### ChatError

Re-exports [ChatError](chat/errors.md#chaterror)

***

### ChatEventBus

Re-exports [ChatEventBus](chat/events.md#chateventbus)

***

### ChatRuntimeOptions

Re-exports [ChatRuntimeOptions](chat/runtime.md#chatruntimeoptions)

***

### classifyError

Re-exports [classifyError](chat/errors.md#classifyerror)

***

### ContextStats

Re-exports [ContextStats](chat/context.md#contextstats)

***

### ContextWindowConfig

Re-exports [ContextWindowConfig](chat/context.md#contextwindowconfig)

***

### ContextWindowManager

Re-exports [ContextWindowManager](chat/context.md#contextwindowmanager)

***

### ContextWindowResult

Re-exports [ContextWindowResult](chat/context.md#contextwindowresult)

***

### createChatRuntime

Re-exports [createChatRuntime](chat/runtime.md#createchatruntime)

***

### CreateSessionOptions

Re-exports [CreateSessionOptions](chat/sessions.md#createsessionoptions)

***

### ErrorCode

Re-exports [ErrorCode](index.md#errorcode)

***

### estimateTokens

Re-exports [estimateTokens](chat/context.md#estimatetokens)

***

### ExponentialBackoffStrategy

Re-exports [ExponentialBackoffStrategy](chat/errors.md#exponentialbackoffstrategy)

***

### FileSessionStore

Re-exports [FileSessionStore](chat/sessions.md#filesessionstore)

***

### IChatClient

Re-exports [IChatClient](chat/runtime.md#ichatclient)

***

### IChatRuntime

Re-exports [IChatRuntime](chat/runtime.md#ichatruntime)

***

### IChatSessionStore

Re-exports [IChatSessionStore](chat/sessions.md#ichatsessionstore)

***

### InMemorySessionStore

Re-exports [InMemorySessionStore](chat/sessions.md#inmemorysessionstore)

***

### IProviderClient

Re-exports [IProviderClient](chat/runtime.md#iproviderclient)

***

### ISessionReader

Re-exports [ISessionReader](chat/sessions.md#isessionreader)

***

### ISessionWriter

Re-exports [ISessionWriter](chat/sessions.md#isessionwriter)

***

### isRetryable

Re-exports [isRetryable](chat/errors.md#isretryable)

***

### MessageAccumulator

Re-exports [MessageAccumulator](chat/accumulator.md#messageaccumulator)

***

### OverflowStrategy

Re-exports [OverflowStrategy](chat/context.md#overflowstrategy)

***

### PaginatedMessages

Re-exports [PaginatedMessages](chat/sessions.md#paginatedmessages)

***

### RetryConfig

Re-exports [RetryConfig](chat/runtime.md#retryconfig-1)

***

### SelectionChangeCallback

Re-exports [SelectionChangeCallback](chat/runtime.md#selectionchangecallback)

***

### StreamRetryConfig

Re-exports [StreamRetryConfig](chat/runtime.md#streamretryconfig)

***

### TypedEventEmitter

Re-exports [TypedEventEmitter](chat/events.md#typedeventemitter)

***

### withRetry

Re-exports [withRetry](chat/errors.md#withretry)

[**@witqq/agent-sdk**](../README.md)

***

[@witqq/agent-sdk](../README.md) / chat/runtime

# chat/runtime

## Interfaces

### BackendInfo

Defined in: [chat/runtime.ts:101](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L101)

Information about a registered backend

#### Properties

##### name

> **name**: `string`

Defined in: [chat/runtime.ts:103](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L103)

Backend name (key in backends map)

***

### ChatRuntimeOptions

Defined in: [chat/runtime.ts:56](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L56)

Configuration for creating a chat runtime via createChatRuntime()

#### Properties

##### backends

> **backends**: `Record`\<`string`, [`BackendAdapterFactory`](#backendadapterfactory)\>

Defined in: [chat/runtime.ts:58](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L58)

Map of backend name → adapter factory (lazy creation on first use)

##### context?

> `optional` **context**: [`ContextWindowConfig`](context.md#contextwindowconfig)

Defined in: [chat/runtime.ts:64](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L64)

Context window configuration (optional)

##### defaultBackend

> **defaultBackend**: `string`

Defined in: [chat/runtime.ts:60](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L60)

Default backend name (must be a key in `backends`)

##### middleware?

> `optional` **middleware**: [`ChatMiddleware`](../chat.md#chatmiddleware)[]

Defined in: [chat/runtime.ts:66](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L66)

Middleware pipeline (optional, applied in order)

##### onContextTrimmed()?

> `optional` **onContextTrimmed**: (`sessionId`, `removedMessages`) => `void`

Defined in: [chat/runtime.ts:79](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L79)

Called when context trimming removes messages.
Use for archiving, logging, or analytics.

###### Parameters

###### sessionId

[`ChatIdLike`](../chat.md#chatidlike)

###### removedMessages

[`ChatMessage`](../chat.md#chatmessage)\<`unknown`\>[]

###### Returns

`void`

##### retryConfig?

> `optional` **retryConfig**: [`StreamRetryConfig`](#streamretryconfig)

Defined in: [chat/runtime.ts:68](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L68)

Retry configuration for pre-stream connection errors

##### sessionStore

> **sessionStore**: [`IChatSessionStore`](sessions.md#ichatsessionstore)

Defined in: [chat/runtime.ts:62](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L62)

Session store for persistence

##### streamTimeoutMs?

> `optional` **streamTimeoutMs**: `number`

Defined in: [chat/runtime.ts:74](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L74)

Stream inactivity timeout in milliseconds (optional).
When set, aborts the stream if no events arrive within this window.
Timer resets after each received event.

##### tools?

> `optional` **tools**: [`ToolDefinition`](../index.md#tooldefinition)\<`unknown`\>[]

Defined in: [chat/runtime.ts:84](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L84)

Initial tools to register on the runtime.
Equivalent to calling `registerTool()` for each tool after creation.

***

### IChatClient

Defined in: [chat/runtime.ts:135](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L135)

Client-side interface for interacting with a remote chat server.
Fully self-contained — no shared base with IChatRuntime.
Extends IProviderClient for provider CRUD (ISP).
Used by React components and remote clients.

#### Extends

- [`IProviderClient`](#iproviderclient)

#### Type Parameters

##### TMetadata

`TMetadata` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

Type-level convenience for message metadata.
  NOT enforced at the storage boundary — session stores always use `unknown`.
  Consumers are responsible for metadata shape consistency.

#### Properties

##### activeSessionId

> `readonly` **activeSessionId**: [`ChatId`](../chat.md#chatid) \| `null`

Defined in: [chat/runtime.ts:150](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L150)

##### selectedProviderId

> `readonly` **selectedProviderId**: `string` \| `null`

Defined in: [chat/runtime.ts:165](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L165)

##### status

> `readonly` **status**: [`RuntimeStatus`](../chat.md#runtimestatus)

Defined in: [chat/runtime.ts:139](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L139)

#### Methods

##### abort()

> **abort**(): `void`

Defined in: [chat/runtime.ts:161](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L161)

###### Returns

`void`

##### createProvider()

> **createProvider**(`config`): `Promise`\<[`ProviderConfig`](../chat.md#providerconfig)\>

Defined in: [chat/runtime.ts:115](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L115)

###### Parameters

###### config

`Omit`\<[`ProviderConfig`](../chat.md#providerconfig), `"id"` \| `"createdAt"`\>

###### Returns

`Promise`\<[`ProviderConfig`](../chat.md#providerconfig)\>

###### Inherited from

[`IProviderClient`](#iproviderclient).[`createProvider`](#createprovider-1)

##### createSession()

> **createSession**(`options`): `Promise`\<[`ChatSession`](../chat.md#chatsession)\<`TMetadata`\>\>

Defined in: [chat/runtime.ts:143](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L143)

###### Parameters

###### options

[`CreateSessionOptions`](sessions.md#createsessionoptions)\<`TMetadata`\>

###### Returns

`Promise`\<[`ChatSession`](../chat.md#chatsession)\<`TMetadata`\>\>

##### deleteProvider()

> **deleteProvider**(`id`): `Promise`\<`void`\>

Defined in: [chat/runtime.ts:117](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L117)

###### Parameters

###### id

`string`

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`IProviderClient`](#iproviderclient).[`deleteProvider`](#deleteprovider-1)

##### deleteSession()

> **deleteSession**(`id`): `Promise`\<`void`\>

Defined in: [chat/runtime.ts:146](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L146)

###### Parameters

###### id

[`ChatIdLike`](../chat.md#chatidlike)

###### Returns

`Promise`\<`void`\>

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [chat/runtime.ts:140](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L140)

###### Returns

`Promise`\<`void`\>

##### getContextStats()

> **getContextStats**(`sessionId`): `Promise`\<[`ContextStats`](context.md#contextstats) \| `null`\>

Defined in: [chat/runtime.ts:176](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L176)

###### Parameters

###### sessionId

[`ChatIdLike`](../chat.md#chatidlike)

###### Returns

`Promise`\<[`ContextStats`](context.md#contextstats) \| `null`\>

##### getSession()

> **getSession**(`id`): `Promise`\<[`ChatSession`](../chat.md#chatsession)\<`TMetadata`\> \| `null`\>

Defined in: [chat/runtime.ts:144](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L144)

###### Parameters

###### id

[`ChatIdLike`](../chat.md#chatidlike)

###### Returns

`Promise`\<[`ChatSession`](../chat.md#chatsession)\<`TMetadata`\> \| `null`\>

##### listBackends()

> **listBackends**(): `Promise`\<[`BackendInfo`](#backendinfo)[]\>

Defined in: [chat/runtime.ts:173](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L173)

###### Returns

`Promise`\<[`BackendInfo`](#backendinfo)[]\>

##### listModels()

> **listModels**(): `Promise`\<[`ModelInfo`](../index.md#modelinfo)[]\>

Defined in: [chat/runtime.ts:172](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L172)

###### Returns

`Promise`\<[`ModelInfo`](../index.md#modelinfo)[]\>

##### listProviders()

> **listProviders**(): `Promise`\<[`ProviderConfig`](../chat.md#providerconfig)[]\>

Defined in: [chat/runtime.ts:114](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L114)

###### Returns

`Promise`\<[`ProviderConfig`](../chat.md#providerconfig)[]\>

###### Inherited from

[`IProviderClient`](#iproviderclient).[`listProviders`](#listproviders-1)

##### listSessions()

> **listSessions**(`options?`): `Promise`\<[`ChatSession`](../chat.md#chatsession)\<`TMetadata`\>[]\>

Defined in: [chat/runtime.ts:145](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L145)

###### Parameters

###### options?

[`SessionListOptions`](sessions.md#sessionlistoptions)

###### Returns

`Promise`\<[`ChatSession`](../chat.md#chatsession)\<`TMetadata`\>[]\>

##### onSelectionChange()

> **onSelectionChange**(`callback`): () => `void`

Defined in: [chat/runtime.ts:166](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L166)

###### Parameters

###### callback

[`SelectionChangeCallback`](#selectionchangecallback)

###### Returns

> (): `void`

###### Returns

`void`

##### onSessionChange()

> **onSessionChange**(`callback`): () => `void`

Defined in: [chat/runtime.ts:169](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L169)

###### Parameters

###### callback

() => `void`

###### Returns

> (): `void`

###### Returns

`void`

##### selectProvider()

> **selectProvider**(`providerId`): `void`

Defined in: [chat/runtime.ts:164](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L164)

###### Parameters

###### providerId

`string`

###### Returns

`void`

##### send()

> **send**(`sessionId`, `message`, `options?`): `AsyncIterable`\<[`ChatEvent`](../chat.md#chatevent)\>

Defined in: [chat/runtime.ts:158](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L158)

Send a message. Options are optional — the server handler resolves
model and backend from provider selection state.
Compare with IChatRuntime.send() where RuntimeSendOptions is required.

###### Parameters

###### sessionId

[`ChatIdLike`](../chat.md#chatidlike)

###### message

`string`

###### options?

[`SendMessageOptions`](../chat.md#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](../chat.md#chatevent)\>

##### switchSession()

> **switchSession**(`id`): `Promise`\<[`ChatSession`](../chat.md#chatsession)\<`TMetadata`\>\>

Defined in: [chat/runtime.ts:149](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L149)

###### Parameters

###### id

[`ChatIdLike`](../chat.md#chatidlike)

###### Returns

`Promise`\<[`ChatSession`](../chat.md#chatsession)\<`TMetadata`\>\>

##### updateProvider()

> **updateProvider**(`id`, `changes`): `Promise`\<`void`\>

Defined in: [chat/runtime.ts:116](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L116)

###### Parameters

###### id

`string`

###### changes

`Partial`\<`Omit`\<[`ProviderConfig`](../chat.md#providerconfig), `"id"` \| `"createdAt"`\>\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`IProviderClient`](#iproviderclient).[`updateProvider`](#updateprovider-1)

***

### IChatRuntime

Defined in: [chat/runtime.ts:192](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L192)

Server-side chat runtime. Fully self-contained — no shared base with IChatClient.
Manages backend adapters, tools, middleware, and context trimming.
Does NOT include client-facing provider CRUD or selection — those are
handled by the server handler layer.

#### Type Parameters

##### TMetadata

`TMetadata` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

Type-level convenience for message metadata.
  NOT enforced at the storage boundary — session stores always use `unknown`.
  Casts in `ChatRuntime.createSession()`/`getSession()` are intentionally unsafe
  to provide typed access. Consumers are responsible for metadata shape consistency.

#### Properties

##### registeredTools

> `readonly` **registeredTools**: `ReadonlyMap`\<`string`, [`ToolDefinition`](../index.md#tooldefinition)\<`unknown`\>\>

Defined in: [chat/runtime.ts:225](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L225)

##### status

> `readonly` **status**: [`RuntimeStatus`](../chat.md#runtimestatus)

Defined in: [chat/runtime.ts:195](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L195)

#### Methods

##### abort()

> **abort**(): `void`

Defined in: [chat/runtime.ts:213](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L213)

###### Returns

`void`

##### createSession()

> **createSession**(`options`): `Promise`\<[`ChatSession`](../chat.md#chatsession)\<`TMetadata`\>\>

Defined in: [chat/runtime.ts:199](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L199)

###### Parameters

###### options

[`CreateSessionOptions`](sessions.md#createsessionoptions)\<`TMetadata`\>

###### Returns

`Promise`\<[`ChatSession`](../chat.md#chatsession)\<`TMetadata`\>\>

##### deleteSession()

> **deleteSession**(`id`): `Promise`\<`void`\>

Defined in: [chat/runtime.ts:202](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L202)

###### Parameters

###### id

[`ChatIdLike`](../chat.md#chatidlike)

###### Returns

`Promise`\<`void`\>

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [chat/runtime.ts:196](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L196)

###### Returns

`Promise`\<`void`\>

##### getContextStats()

> **getContextStats**(`sessionId`): `Promise`\<[`ContextStats`](context.md#contextstats) \| `null`\>

Defined in: [chat/runtime.ts:232](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L232)

###### Parameters

###### sessionId

[`ChatIdLike`](../chat.md#chatidlike)

###### Returns

`Promise`\<[`ContextStats`](context.md#contextstats) \| `null`\>

##### getSession()

> **getSession**(`id`): `Promise`\<[`ChatSession`](../chat.md#chatsession)\<`TMetadata`\> \| `null`\>

Defined in: [chat/runtime.ts:200](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L200)

###### Parameters

###### id

[`ChatIdLike`](../chat.md#chatidlike)

###### Returns

`Promise`\<[`ChatSession`](../chat.md#chatsession)\<`TMetadata`\> \| `null`\>

##### listBackends()

> **listBackends**(): `Promise`\<[`BackendInfo`](#backendinfo)[]\>

Defined in: [chat/runtime.ts:220](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L220)

###### Returns

`Promise`\<[`BackendInfo`](#backendinfo)[]\>

##### listModels()

> **listModels**(`options?`): `Promise`\<[`ModelInfo`](../index.md#modelinfo)[]\>

Defined in: [chat/runtime.ts:219](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L219)

###### Parameters

###### options?

###### backend?

`string`

###### credentials?

[`AuthToken`](../auth.md#authtoken)

###### Returns

`Promise`\<[`ModelInfo`](../index.md#modelinfo)[]\>

##### listSessions()

> **listSessions**(`options?`): `Promise`\<[`ChatSession`](../chat.md#chatsession)\<`TMetadata`\>[]\>

Defined in: [chat/runtime.ts:201](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L201)

###### Parameters

###### options?

[`SessionListOptions`](sessions.md#sessionlistoptions)

###### Returns

`Promise`\<[`ChatSession`](../chat.md#chatsession)\<`TMetadata`\>[]\>

##### onSessionChange()

> **onSessionChange**(`callback`): () => `void`

Defined in: [chat/runtime.ts:216](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L216)

###### Parameters

###### callback

() => `void`

###### Returns

> (): `void`

###### Returns

`void`

##### registerTool()

> **registerTool**(`tool`): `void`

Defined in: [chat/runtime.ts:223](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L223)

###### Parameters

###### tool

[`ToolDefinition`](../index.md#tooldefinition)

###### Returns

`void`

##### removeMiddleware()

> **removeMiddleware**(`middleware`): `void`

Defined in: [chat/runtime.ts:229](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L229)

###### Parameters

###### middleware

[`ChatMiddleware`](../chat.md#chatmiddleware)

###### Returns

`void`

##### removeTool()

> **removeTool**(`name`): `void`

Defined in: [chat/runtime.ts:224](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L224)

###### Parameters

###### name

`string`

###### Returns

`void`

##### send()

> **send**(`sessionId`, `message`, `options`): `AsyncIterable`\<[`ChatEvent`](../chat.md#chatevent)\>

Defined in: [chat/runtime.ts:210](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L210)

Send a message. RuntimeSendOptions is required on the server — the caller
(usually a handler) must supply backend, model, and credentials.
Compare with IChatClient.send() where options are optional.

###### Parameters

###### sessionId

[`ChatIdLike`](../chat.md#chatidlike)

###### message

`string`

###### options

[`RuntimeSendOptions`](../chat.md#runtimesendoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](../chat.md#chatevent)\>

##### use()

> **use**(`middleware`): `void`

Defined in: [chat/runtime.ts:228](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L228)

###### Parameters

###### middleware

[`ChatMiddleware`](../chat.md#chatmiddleware)

###### Returns

`void`

***

### IProviderClient

Defined in: [chat/runtime.ts:113](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L113)

Provider CRUD operations — separated per Interface Segregation Principle.
Implemented by IChatClient (which needs provider management for UI).
Not required on IChatRuntime (providers are a handler-layer concern).

#### Extended by

- [`IChatClient`](#ichatclient)

#### Methods

##### createProvider()

> **createProvider**(`config`): `Promise`\<[`ProviderConfig`](../chat.md#providerconfig)\>

Defined in: [chat/runtime.ts:115](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L115)

###### Parameters

###### config

`Omit`\<[`ProviderConfig`](../chat.md#providerconfig), `"id"` \| `"createdAt"`\>

###### Returns

`Promise`\<[`ProviderConfig`](../chat.md#providerconfig)\>

##### deleteProvider()

> **deleteProvider**(`id`): `Promise`\<`void`\>

Defined in: [chat/runtime.ts:117](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L117)

###### Parameters

###### id

`string`

###### Returns

`Promise`\<`void`\>

##### listProviders()

> **listProviders**(): `Promise`\<[`ProviderConfig`](../chat.md#providerconfig)[]\>

Defined in: [chat/runtime.ts:114](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L114)

###### Returns

`Promise`\<[`ProviderConfig`](../chat.md#providerconfig)[]\>

##### updateProvider()

> **updateProvider**(`id`, `changes`): `Promise`\<`void`\>

Defined in: [chat/runtime.ts:116](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L116)

###### Parameters

###### id

`string`

###### changes

`Partial`\<`Omit`\<[`ProviderConfig`](../chat.md#providerconfig), `"id"` \| `"createdAt"`\>\>

###### Returns

`Promise`\<`void`\>

***

### StreamRetryConfig

Defined in: [chat/runtime.ts:88](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L88)

Retry configuration for pre-stream failures (renamed to avoid clash with agent-level RetryConfig)

#### Properties

##### delayMs

> **delayMs**: `number`

Defined in: [chat/runtime.ts:92](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L92)

Delay between retries in milliseconds

##### maxAttempts

> **maxAttempts**: `number`

Defined in: [chat/runtime.ts:90](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L90)

Maximum number of attempts (default: 1 = no retry)

## Type Aliases

### BackendAdapterFactory()

> **BackendAdapterFactory** = (`credentials`) => [`IChatBackend`](../chat.md#ichatbackend) \| `Promise`\<[`IChatBackend`](../chat.md#ichatbackend)\>

Defined in: [chat/runtime.ts:53](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L53)

Factory function that creates a backend adapter on demand

#### Parameters

##### credentials

[`AuthToken`](../auth.md#authtoken)

#### Returns

[`IChatBackend`](../chat.md#ichatbackend) \| `Promise`\<[`IChatBackend`](../chat.md#ichatbackend)\>

***

### ~~RetryConfig~~

> **RetryConfig** = [`StreamRetryConfig`](#streamretryconfig)

Defined in: [chat/runtime.ts:96](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L96)

#### Deprecated

Use StreamRetryConfig

***

### SelectionChangeCallback()

> **SelectionChangeCallback** = (`providerId`) => `void`

Defined in: [chat/runtime.ts:123](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L123)

Callback for provider selection changes

#### Parameters

##### providerId

`string` | `null`

#### Returns

`void`

## Functions

### createChatRuntime()

> **createChatRuntime**\<`TMetadata`\>(`options`): [`IChatRuntime`](#ichatruntime)\<`TMetadata`\>

Defined in: [chat/runtime.ts:920](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/runtime.ts#L920)

Create a fully-wired chat runtime from configuration.

#### Type Parameters

##### TMetadata

`TMetadata` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Parameters

##### options

[`ChatRuntimeOptions`](#chatruntimeoptions)

Runtime configuration (backends, session store, context, middleware)

#### Returns

[`IChatRuntime`](#ichatruntime)\<`TMetadata`\>

IChatRuntime instance ready to use

#### Example

```typescript
import { createChatRuntime } from "@witqq/agent-sdk/chat/runtime";
import { InMemorySessionStore } from "@witqq/agent-sdk/chat/sessions";

const runtime = createChatRuntime({
  backends: {
    copilot: () => new CopilotAdapter({ agentConfig: { model: "gpt-4" } }),
  },
  defaultBackend: "copilot",
  sessionStore: new InMemorySessionStore(),
});
```

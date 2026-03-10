[**@witqq/agent-sdk**](../../../README.md)

***

[@witqq/agent-sdk](../../../README.md) / @witqq/agent-sdk/chat/react

# @witqq/agent-sdk/chat/react

React bindings for agent-sdk chat module.

Headless hooks and components that wrap IChatClient
for building chat UIs with minimal boilerplate.

## Classes

### RemoteChatClient

Defined in: [chat/react/RemoteChatClient.ts:59](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L59)

Client-side interface for interacting with a remote chat server.
Fully self-contained — no shared base with IChatRuntime.
Extends IProviderClient for provider CRUD (ISP).
Used by React components and remote clients.

#### Implements

- [`IChatClient`](../../../chat/runtime.md#ichatclient)

#### Constructors

##### Constructor

> **new RemoteChatClient**(`options`): [`RemoteChatClient`](#remotechatclient)

Defined in: [chat/react/RemoteChatClient.ts:70](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L70)

###### Parameters

###### options

[`RemoteChatClientOptions`](#remotechatclientoptions)

###### Returns

[`RemoteChatClient`](#remotechatclient)

#### Accessors

##### activeSessionId

###### Get Signature

> **get** **activeSessionId**(): [`ChatId`](../../../chat.md#chatid) \| `null`

Defined in: [chat/react/RemoteChatClient.ts:115](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L115)

###### Returns

[`ChatId`](../../../chat.md#chatid) \| `null`

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`activeSessionId`](../../../chat/runtime.md#activesessionid)

##### selectedProviderId

###### Get Signature

> **get** **selectedProviderId**(): `string` \| `null`

Defined in: [chat/react/RemoteChatClient.ts:95](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L95)

###### Returns

`string` \| `null`

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`selectedProviderId`](../../../chat/runtime.md#selectedproviderid)

##### status

###### Get Signature

> **get** **status**(): [`RuntimeStatus`](../../../chat.md#runtimestatus)

Defined in: [chat/react/RemoteChatClient.ts:78](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L78)

###### Returns

[`RuntimeStatus`](../../../chat.md#runtimestatus)

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`status`](../../../chat/runtime.md#status)

#### Methods

##### abort()

> **abort**(): `void`

Defined in: [chat/react/RemoteChatClient.ts:223](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L223)

###### Returns

`void`

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`abort`](../../../chat/runtime.md#abort)

##### createProvider()

> **createProvider**(`config`): `Promise`\<[`ProviderConfig`](../../../chat.md#providerconfig)\>

Defined in: [chat/react/RemoteChatClient.ts:257](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L257)

###### Parameters

###### config

`Omit`\<[`ProviderConfig`](../../../chat.md#providerconfig), `"id"` \| `"createdAt"`\>

###### Returns

`Promise`\<[`ProviderConfig`](../../../chat.md#providerconfig)\>

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`createProvider`](../../../chat/runtime.md#createprovider)

##### createSession()

> **createSession**(`options`): `Promise`\<[`ChatSession`](../../../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\>\>

Defined in: [chat/react/RemoteChatClient.ts:119](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L119)

###### Parameters

###### options

[`CreateSessionOptions`](../../../chat/sessions.md#createsessionoptions)

###### Returns

`Promise`\<[`ChatSession`](../../../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\>\>

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`createSession`](../../../chat/runtime.md#createsession)

##### deleteProvider()

> **deleteProvider**(`id`): `Promise`\<`void`\>

Defined in: [chat/react/RemoteChatClient.ts:268](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L268)

###### Parameters

###### id

`string`

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`deleteProvider`](../../../chat/runtime.md#deleteprovider)

##### deleteSession()

> **deleteSession**(`id`): `Promise`\<`void`\>

Defined in: [chat/react/RemoteChatClient.ts:141](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L141)

###### Parameters

###### id

[`ChatIdLike`](../../../chat.md#chatidlike)

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`deleteSession`](../../../chat/runtime.md#deletesession)

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [chat/react/RemoteChatClient.ts:82](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L82)

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`dispose`](../../../chat/runtime.md#dispose)

##### getContextStats()

> **getContextStats**(`sessionId`): `Promise`\<[`ContextStats`](../../../chat/context.md#contextstats) \| `null`\>

Defined in: [chat/react/RemoteChatClient.ts:154](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L154)

Fetch context window stats from server.
Returns null if stats not available (e.g. no messages sent yet).

###### Parameters

###### sessionId

[`ChatIdLike`](../../../chat.md#chatidlike)

###### Returns

`Promise`\<[`ContextStats`](../../../chat/context.md#contextstats) \| `null`\>

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`getContextStats`](../../../chat/runtime.md#getcontextstats)

##### getSession()

> **getSession**(`id`): `Promise`\<[`ChatSession`](../../../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\> \| `null`\>

Defined in: [chat/react/RemoteChatClient.ts:128](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L128)

###### Parameters

###### id

[`ChatIdLike`](../../../chat.md#chatidlike)

###### Returns

`Promise`\<[`ChatSession`](../../../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\> \| `null`\>

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`getSession`](../../../chat/runtime.md#getsession)

##### listBackends()

> **listBackends**(): `Promise`\<[`BackendInfo`](../../../chat/runtime.md#backendinfo)[]\>

Defined in: [chat/react/RemoteChatClient.ts:243](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L243)

###### Returns

`Promise`\<[`BackendInfo`](../../../chat/runtime.md#backendinfo)[]\>

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`listBackends`](../../../chat/runtime.md#listbackends)

##### listModels()

> **listModels**(): `Promise`\<[`ModelInfo`](../../../index.md#modelinfo)[]\>

Defined in: [chat/react/RemoteChatClient.ts:237](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L237)

###### Returns

`Promise`\<[`ModelInfo`](../../../index.md#modelinfo)[]\>

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`listModels`](../../../chat/runtime.md#listmodels)

##### listProviders()

> **listProviders**(): `Promise`\<[`ProviderConfig`](../../../chat.md#providerconfig)[]\>

Defined in: [chat/react/RemoteChatClient.ts:251](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L251)

###### Returns

`Promise`\<[`ProviderConfig`](../../../chat.md#providerconfig)[]\>

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`listProviders`](../../../chat/runtime.md#listproviders)

##### listSessions()

> **listSessions**(`_options?`): `Promise`\<[`ChatSession`](../../../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

Defined in: [chat/react/RemoteChatClient.ts:135](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L135)

###### Parameters

###### \_options?

[`SessionListOptions`](../../../chat/sessions.md#sessionlistoptions)

###### Returns

`Promise`\<[`ChatSession`](../../../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`listSessions`](../../../chat/runtime.md#listsessions)

##### onSelectionChange()

> **onSelectionChange**(`callback`): () => `void`

Defined in: [chat/react/RemoteChatClient.ts:105](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L105)

###### Parameters

###### callback

[`SelectionChangeCallback`](../../../chat/runtime.md#selectionchangecallback)

###### Returns

> (): `void`

###### Returns

`void`

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`onSelectionChange`](../../../chat/runtime.md#onselectionchange)

##### onSessionChange()

> **onSessionChange**(`callback`): () => `void`

Defined in: [chat/react/RemoteChatClient.ts:277](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L277)

###### Parameters

###### callback

() => `void`

###### Returns

> (): `void`

###### Returns

`void`

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`onSessionChange`](../../../chat/runtime.md#onsessionchange)

##### selectProvider()

> **selectProvider**(`providerId`): `void`

Defined in: [chat/react/RemoteChatClient.ts:99](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L99)

###### Parameters

###### providerId

`string`

###### Returns

`void`

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`selectProvider`](../../../chat/runtime.md#selectprovider)

##### send()

> **send**(`sessionId`, `message`, `options?`): `AsyncIterable`\<[`ChatEvent`](../../../chat.md#chatevent)\>

Defined in: [chat/react/RemoteChatClient.ts:172](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L172)

Send a message. Options are optional — the server handler resolves
model and backend from provider selection state.
Compare with IChatRuntime.send() where RuntimeSendOptions is required.

###### Parameters

###### sessionId

[`ChatIdLike`](../../../chat.md#chatidlike)

###### message

`string`

###### options?

[`SendMessageOptions`](../../../chat.md#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](../../../chat.md#chatevent)\>

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`send`](../../../chat/runtime.md#send)

##### switchSession()

> **switchSession**(`id`): `Promise`\<[`ChatSession`](../../../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\>\>

Defined in: [chat/react/RemoteChatClient.ts:161](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L161)

###### Parameters

###### id

[`ChatIdLike`](../../../chat.md#chatidlike)

###### Returns

`Promise`\<[`ChatSession`](../../../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\>\>

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`switchSession`](../../../chat/runtime.md#switchsession)

##### updateProvider()

> **updateProvider**(`id`, `changes`): `Promise`\<`void`\>

Defined in: [chat/react/RemoteChatClient.ts:263](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L263)

###### Parameters

###### id

`string`

###### changes

`Partial`\<`Omit`\<[`ProviderConfig`](../../../chat.md#providerconfig), `"id"` \| `"createdAt"`\>\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IChatClient`](../../../chat/runtime.md#ichatclient).[`updateProvider`](../../../chat/runtime.md#updateprovider)

## Interfaces

### AuthFormProps

Defined in: [chat/react/auth/types.ts:8](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/types.ts#L8)

Props passed to per-backend auth form components.
Each backend implements its own form using these props.

#### Properties

##### auth

> **auth**: [`UseRemoteAuthReturn`](#useremoteauthreturn)

Defined in: [chat/react/auth/types.ts:10](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/types.ts#L10)

The remote auth hook instance, pre-configured for this backend.

##### onAuthComplete()

> **onAuthComplete**: () => `void`

Defined in: [chat/react/auth/types.ts:12](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/types.ts#L12)

Called when authentication completes successfully.

###### Returns

`void`

***

### BackendSelectorProps

Defined in: [chat/react/BackendSelector.ts:9](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/BackendSelector.ts#L9)

Props for the BackendSelector component.

#### Properties

##### backends

> **backends**: [`BackendInfo`](../../../chat/runtime.md#backendinfo)[]

Defined in: [chat/react/BackendSelector.ts:10](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/BackendSelector.ts#L10)

##### className?

> `optional` **className**: `string`

Defined in: [chat/react/BackendSelector.ts:12](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/BackendSelector.ts#L12)

##### onSelect()

> **onSelect**: (`name`) => `void`

Defined in: [chat/react/BackendSelector.ts:11](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/BackendSelector.ts#L11)

###### Parameters

###### name

`string`

###### Returns

`void`

***

### ChatHeaderProps

Defined in: [chat/react/ChatHeader.ts:15](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatHeader.ts#L15)

Props for the ChatHeader component.

#### Properties

##### backends?

> `optional` **backends**: [`BackendInfo`](../../../chat/runtime.md#backendinfo)[]

Defined in: [chat/react/ChatHeader.ts:23](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatHeader.ts#L23)

Available backends list.

##### BackendSelectorComponent?

> `optional` **BackendSelectorComponent**: `ComponentType`\<[`BackendSelectorProps`](#backendselectorprops)\>

Defined in: [chat/react/ChatHeader.ts:33](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatHeader.ts#L33)

Slot override for BackendSelector.

##### hasProviders?

> `optional` **hasProviders**: `boolean`

Defined in: [chat/react/ChatHeader.ts:21](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatHeader.ts#L21)

Whether providers are configured (hides model selector when true).

##### models?

> `optional` **models**: [`ModelOption`](#modeloption)[]

Defined in: [chat/react/ChatHeader.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatHeader.ts#L25)

Available models list.

##### ModelSelectorComponent?

> `optional` **ModelSelectorComponent**: `ComponentType`\<[`ModelSelectorProps`](#modelselectorprops)\>

Defined in: [chat/react/ChatHeader.ts:35](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatHeader.ts#L35)

Slot override for ModelSelector.

##### onBackendSelect()?

> `optional` **onBackendSelect**: (`name`) => `void`

Defined in: [chat/react/ChatHeader.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatHeader.ts#L29)

Backend selection handler.

###### Parameters

###### name

`string`

###### Returns

`void`

##### onModelSelect()?

> `optional` **onModelSelect**: (`modelId`) => `void`

Defined in: [chat/react/ChatHeader.ts:31](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatHeader.ts#L31)

Model selection handler.

###### Parameters

###### modelId

`string`

###### Returns

`void`

##### selectedModel?

> `optional` **selectedModel**: `string`

Defined in: [chat/react/ChatHeader.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatHeader.ts#L27)

Currently selected model.

##### showBackendSelector?

> `optional` **showBackendSelector**: `boolean`

Defined in: [chat/react/ChatHeader.ts:17](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatHeader.ts#L17)

Whether to show backend selector. Default: false.

##### showModelSelector?

> `optional` **showModelSelector**: `boolean`

Defined in: [chat/react/ChatHeader.ts:19](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatHeader.ts#L19)

Whether to show model selector. Default: true.

***

### ChatInputAreaProps

Defined in: [chat/react/ChatInputArea.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatInputArea.ts#L16)

Props for the ChatInputArea component.

#### Properties

##### activeProviderId?

> `optional` **activeProviderId**: `string`

Defined in: [chat/react/ChatInputArea.ts:30](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatInputArea.ts#L30)

Active provider ID.

##### ComposerComponent?

> `optional` **ComposerComponent**: `ComponentType`\<[`ComposerProps`](#composerprops)\>

Defined in: [chat/react/ChatInputArea.ts:40](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatInputArea.ts#L40)

Slot override for Composer.

##### isGenerating?

> `optional` **isGenerating**: `boolean`

Defined in: [chat/react/ChatInputArea.ts:22](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatInputArea.ts#L22)

Whether generation is in progress.

##### models?

> `optional` **models**: [`ModelOption`](#modeloption)[]

Defined in: [chat/react/ChatInputArea.ts:28](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatInputArea.ts#L28)

Available models.

##### onSelectModel()?

> `optional` **onSelectModel**: (`modelId`) => `void`

Defined in: [chat/react/ChatInputArea.ts:36](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatInputArea.ts#L36)

Model selection handler.

###### Parameters

###### modelId

`string`

###### Returns

`void`

##### onSelectProvider()?

> `optional` **onSelectProvider**: (`id`) => `void`

Defined in: [chat/react/ChatInputArea.ts:34](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatInputArea.ts#L34)

Provider selection handler.

###### Parameters

###### id

`string`

###### Returns

`void`

##### onSend()

> **onSend**: (`message`) => `void`

Defined in: [chat/react/ChatInputArea.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatInputArea.ts#L18)

Send message handler.

###### Parameters

###### message

`string`

###### Returns

`void`

##### onSettingsClick()?

> `optional` **onSettingsClick**: () => `void`

Defined in: [chat/react/ChatInputArea.ts:38](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatInputArea.ts#L38)

Settings button handler.

###### Returns

`void`

##### onStop()?

> `optional` **onStop**: () => `void`

Defined in: [chat/react/ChatInputArea.ts:20](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatInputArea.ts#L20)

Stop generation handler.

###### Returns

`void`

##### placeholder?

> `optional` **placeholder**: `string`

Defined in: [chat/react/ChatInputArea.ts:24](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatInputArea.ts#L24)

Placeholder text for the textarea.

##### ProviderModelSelectorComponent?

> `optional` **ProviderModelSelectorComponent**: `ComponentType`\<[`ProviderModelSelectorProps`](#providermodelselectorprops)\>

Defined in: [chat/react/ChatInputArea.ts:42](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatInputArea.ts#L42)

Slot override for ProviderModelSelector.

##### providers?

> `optional` **providers**: [`ProviderConfig`](../../../chat.md#providerconfig)[]

Defined in: [chat/react/ChatInputArea.ts:26](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatInputArea.ts#L26)

Available providers.

##### selectedModel?

> `optional` **selectedModel**: `string`

Defined in: [chat/react/ChatInputArea.ts:32](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatInputArea.ts#L32)

Selected model.

##### usage?

> `optional` **usage**: [`ChatUsage`](#chatusage) \| `null`

Defined in: [chat/react/ChatInputArea.ts:44](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatInputArea.ts#L44)

Token usage data to display.

***

### ChatLayoutProps

Defined in: [chat/react/ChatLayout.ts:11](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatLayout.ts#L11)

Props for the ChatLayout component.

#### Properties

##### children

> **children**: `ReactNode`

Defined in: [chat/react/ChatLayout.ts:13](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatLayout.ts#L13)

Main chat content (thread, input area, etc.).

##### className?

> `optional` **className**: `string`

Defined in: [chat/react/ChatLayout.ts:19](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatLayout.ts#L19)

CSS class on the root element.

##### overlay?

> `optional` **overlay**: `ReactNode` \| `ReactNode`[]

Defined in: [chat/react/ChatLayout.ts:17](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatLayout.ts#L17)

Modal/overlay content. Accepts a single node or array of nodes.

##### sidebar?

> `optional` **sidebar**: `ReactNode`

Defined in: [chat/react/ChatLayout.ts:15](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatLayout.ts#L15)

Sidebar content (thread list, session list, etc.).

***

### ChatSettingsOverlayProps

Defined in: [chat/react/ChatSettingsOverlay.ts:13](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatSettingsOverlay.ts#L13)

Props for the ChatSettingsOverlay component.

#### Properties

##### authBaseUrl?

> `optional` **authBaseUrl**: `string`

Defined in: [chat/react/ChatSettingsOverlay.ts:21](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatSettingsOverlay.ts#L21)

Auth API base URL.

##### onAuthCompleted()?

> `optional` **onAuthCompleted**: (`backend`) => `void`

Defined in: [chat/react/ChatSettingsOverlay.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatSettingsOverlay.ts#L29)

Called when authentication succeeds. Parent should refresh providers.

###### Parameters

###### backend

`string`

###### Returns

`void`

##### onClose()

> **onClose**: () => `void`

Defined in: [chat/react/ChatSettingsOverlay.ts:17](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatSettingsOverlay.ts#L17)

Close handler.

###### Returns

`void`

##### onProviderCreated()?

> `optional` **onProviderCreated**: (`provider`) => `void`

Defined in: [chat/react/ChatSettingsOverlay.ts:23](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatSettingsOverlay.ts#L23)

Provider created handler.

###### Parameters

###### provider

###### backend

`string`

###### label?

`string`

###### model

`string`

###### Returns

`void`

##### onProviderDeleted()?

> `optional` **onProviderDeleted**: (`id`) => `void`

Defined in: [chat/react/ChatSettingsOverlay.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatSettingsOverlay.ts#L25)

Provider deleted handler.

###### Parameters

###### id

`string`

###### Returns

`void`

##### onProviderUpdated()?

> `optional` **onProviderUpdated**: (`id`, `changes`) => `void`

Defined in: [chat/react/ChatSettingsOverlay.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatSettingsOverlay.ts#L27)

Provider updated handler.

###### Parameters

###### id

`string`

###### changes

`Partial`\<[`ProviderConfig`](../../../chat.md#providerconfig)\>

###### Returns

`void`

##### open

> **open**: `boolean`

Defined in: [chat/react/ChatSettingsOverlay.ts:15](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatSettingsOverlay.ts#L15)

Whether the overlay is visible.

##### providers?

> `optional` **providers**: [`ProviderConfig`](../../../chat.md#providerconfig)[]

Defined in: [chat/react/ChatSettingsOverlay.ts:19](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatSettingsOverlay.ts#L19)

Available providers.

##### ProviderSettingsComponent?

> `optional` **ProviderSettingsComponent**: `ComponentType`\<[`ProviderSettingsProps`](#providersettingsprops)\>

Defined in: [chat/react/ChatSettingsOverlay.ts:31](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatSettingsOverlay.ts#L31)

Slot override for ProviderSettings.

***

### ChatUIProps

Defined in: [chat/react/ChatUI.ts:80](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L80)

Props for the ChatUI composite component.

#### Properties

##### authBaseUrl?

> `optional` **authBaseUrl**: `string`

Defined in: [chat/react/ChatUI.ts:96](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L96)

Base URL for auth API (needed by ProviderSettings).

##### className?

> `optional` **className**: `string`

Defined in: [chat/react/ChatUI.ts:86](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L86)

CSS class on the root element.

##### placeholder?

> `optional` **placeholder**: `string`

Defined in: [chat/react/ChatUI.ts:98](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L98)

Placeholder text for the Composer textarea.

##### runtime

> **runtime**: [`IChatClient`](../../../chat/runtime.md#ichatclient)

Defined in: [chat/react/ChatUI.ts:82](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L82)

The chat runtime or client instance. ChatUI wraps it in ChatProvider. Accepts IChatClient.

##### showBackendSelector?

> `optional` **showBackendSelector**: `boolean`

Defined in: [chat/react/ChatUI.ts:92](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L92)

Show the backend selector in header. Default: false.

##### showModelSelector?

> `optional` **showModelSelector**: `boolean`

Defined in: [chat/react/ChatUI.ts:90](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L90)

Show the model selector header. Default: true.

##### showProviderSelector?

> `optional` **showProviderSelector**: `boolean`

Defined in: [chat/react/ChatUI.ts:94](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L94)

Show the provider selector near composer. Default: auto (true when providers available).

##### showSidebar?

> `optional` **showSidebar**: `boolean`

Defined in: [chat/react/ChatUI.ts:88](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L88)

Show the session sidebar. Default: true.

##### slots?

> `optional` **slots**: [`ChatUISlots`](#chatuislots)

Defined in: [chat/react/ChatUI.ts:84](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L84)

Slot overrides for sub-components.

***

### ChatUISlots

Defined in: [chat/react/ChatUI.ts:50](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L50)

Slot overrides for ChatUI sub-components.

#### Properties

##### authDialog?

> `optional` **authDialog**: `ReactNode`

Defined in: [chat/react/ChatUI.ts:70](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L70)

Custom auth dialog element rendered when provided.

##### backendSelector?

> `optional` **backendSelector**: `ComponentType`\<[`BackendSelectorProps`](#backendselectorprops)\>

Defined in: [chat/react/ChatUI.ts:60](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L60)

Replace the BackendSelector component.

##### composer?

> `optional` **composer**: `ComponentType`\<[`ComposerProps`](#composerprops)\>

Defined in: [chat/react/ChatUI.ts:54](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L54)

Replace the Composer component.

##### contextStats?

> `optional` **contextStats**: `ComponentType`\<[`ContextStatsDisplayProps`](#contextstatsdisplayprops)\>

Defined in: [chat/react/ChatUI.ts:68](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L68)

Replace the ContextStatsDisplay component.

##### modelSelector?

> `optional` **modelSelector**: `ComponentType`\<[`ModelSelectorProps`](#modelselectorprops)\>

Defined in: [chat/react/ChatUI.ts:58](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L58)

Replace the ModelSelector component (used in header when no providers).

##### providerModelSelector?

> `optional` **providerModelSelector**: `ComponentType`\<[`ProviderModelSelectorProps`](#providermodelselectorprops)\>

Defined in: [chat/react/ChatUI.ts:64](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L64)

Replace the unified ProviderModelSelector component (near composer).

##### providerSelector?

> `optional` **providerSelector**: `ComponentType`\<[`ProviderSelectorProps`](#providerselectorprops)\>

Defined in: [chat/react/ChatUI.ts:62](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L62)

Replace the ProviderSelector component (legacy, use providerModelSelector).

##### providerSettings?

> `optional` **providerSettings**: `ComponentType`\<[`ProviderSettingsProps`](#providersettingsprops)\>

Defined in: [chat/react/ChatUI.ts:66](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L66)

Replace the ProviderSettings component.

##### renderMessage()?

> `optional` **renderMessage**: (`message`, `index`) => `ReactNode`

Defined in: [chat/react/ChatUI.ts:72](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L72)

Custom message renderer (forwarded to ThreadProvider).

###### Parameters

###### message

[`ChatMessage`](../../../chat.md#chatmessage)

###### index

`number`

###### Returns

`ReactNode`

##### renderThinkingBlock()?

> `optional` **renderThinkingBlock**: (`part`, `index`) => `ReactNode`

Defined in: [chat/react/ChatUI.ts:76](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L76)

Custom thinking block renderer (forwarded to ThreadProvider).

###### Parameters

###### part

[`ReasoningPart`](../../../chat.md#reasoningpart)

###### index

`number`

###### Returns

`ReactNode`

##### renderToolCall()?

> `optional` **renderToolCall**: (`part`, `index`) => `ReactNode`

Defined in: [chat/react/ChatUI.ts:74](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L74)

Custom tool call renderer (forwarded to ThreadProvider).

###### Parameters

###### part

[`ToolCallPart`](../../../chat.md#toolcallpart)

###### index

`number`

###### Returns

`ReactNode`

##### thread?

> `optional` **thread**: `ComponentType`\<[`ThreadProps`](#threadprops)\>

Defined in: [chat/react/ChatUI.ts:52](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L52)

Replace the Thread component.

##### threadList?

> `optional` **threadList**: `ComponentType`\<[`ThreadListProps`](#threadlistprops)\>

Defined in: [chat/react/ChatUI.ts:56](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L56)

Replace the ThreadList (sidebar) component.

***

### ChatUsage

Defined in: [chat/react/useChat.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L18)

Token usage data from the last completed response.

#### Properties

##### completionTokens

> **completionTokens**: `number`

Defined in: [chat/react/useChat.ts:20](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L20)

##### model?

> `optional` **model**: `string`

Defined in: [chat/react/useChat.ts:22](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L22)

##### promptTokens

> **promptTokens**: `number`

Defined in: [chat/react/useChat.ts:19](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L19)

##### totalTokens

> **totalTokens**: `number`

Defined in: [chat/react/useChat.ts:21](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L21)

***

### ComposerProps

Defined in: [chat/react/Composer.ts:11](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Composer.ts#L11)

Props for the Composer component.

#### Properties

##### className?

> `optional` **className**: `string`

Defined in: [chat/react/Composer.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Composer.ts#L18)

##### disabled?

> `optional` **disabled**: `boolean`

Defined in: [chat/react/Composer.ts:15](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Composer.ts#L15)

##### isGenerating?

> `optional` **isGenerating**: `boolean`

Defined in: [chat/react/Composer.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Composer.ts#L14)

##### maxRows?

> `optional` **maxRows**: `number`

Defined in: [chat/react/Composer.ts:17](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Composer.ts#L17)

##### onSend()

> **onSend**: (`text`) => `void`

Defined in: [chat/react/Composer.ts:12](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Composer.ts#L12)

###### Parameters

###### text

`string`

###### Returns

`void`

##### onStop()?

> `optional` **onStop**: () => `void`

Defined in: [chat/react/Composer.ts:13](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Composer.ts#L13)

###### Returns

`void`

##### placeholder?

> `optional` **placeholder**: `string`

Defined in: [chat/react/Composer.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Composer.ts#L16)

***

### ContextStatsDisplayProps

Defined in: [chat/react/ContextStatsDisplay.ts:5](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ContextStatsDisplay.ts#L5)

Props for the ContextStatsDisplay component.

#### Properties

##### className?

> `optional` **className**: `string`

Defined in: [chat/react/ContextStatsDisplay.ts:9](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ContextStatsDisplay.ts#L9)

CSS class on the root element.

##### stats

> **stats**: [`ContextStats`](../../../chat/context.md#contextstats) \| `null`

Defined in: [chat/react/ContextStatsDisplay.ts:7](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ContextStatsDisplay.ts#L7)

Context stats from runtime.getContextStats(sessionId). Null = nothing to display.

***

### MarkdownRendererProps

Defined in: [chat/react/MarkdownRenderer.ts:4](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/MarkdownRenderer.ts#L4)

Props for the MarkdownRenderer component.

#### Properties

##### content

> **content**: `string`

Defined in: [chat/react/MarkdownRenderer.ts:5](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/MarkdownRenderer.ts#L5)

##### renderCode()?

> `optional` **renderCode**: (`code`, `language?`) => `ReactNode`

Defined in: [chat/react/MarkdownRenderer.ts:6](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/MarkdownRenderer.ts#L6)

###### Parameters

###### code

`string`

###### language?

`string`

###### Returns

`ReactNode`

##### renderLink()?

> `optional` **renderLink**: (`href`, `text`) => `ReactNode`

Defined in: [chat/react/MarkdownRenderer.ts:7](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/MarkdownRenderer.ts#L7)

###### Parameters

###### href

`string`

###### text

`string`

###### Returns

`ReactNode`

***

### MessageProps

Defined in: [chat/react/Message.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Message.ts#L16)

Props for the Message component.

#### Properties

##### message

> **message**: [`ChatMessage`](../../../chat.md#chatmessage)

Defined in: [chat/react/Message.ts:17](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Message.ts#L17)

##### renderFile()?

> `optional` **renderFile**: (`part`, `index`) => `ReactNode`

Defined in: [chat/react/Message.ts:22](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Message.ts#L22)

###### Parameters

###### part

[`FilePart`](../../../chat.md#filepart)

###### index

`number`

###### Returns

`ReactNode`

##### renderReasoning()?

> `optional` **renderReasoning**: (`part`, `index`) => `ReactNode`

Defined in: [chat/react/Message.ts:19](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Message.ts#L19)

###### Parameters

###### part

[`ReasoningPart`](../../../chat.md#reasoningpart)

###### index

`number`

###### Returns

`ReactNode`

##### renderSource()?

> `optional` **renderSource**: (`part`, `index`) => `ReactNode`

Defined in: [chat/react/Message.ts:21](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Message.ts#L21)

###### Parameters

###### part

[`SourcePart`](../../../chat.md#sourcepart)

###### index

`number`

###### Returns

`ReactNode`

##### renderText()?

> `optional` **renderText**: (`part`, `index`) => `ReactNode`

Defined in: [chat/react/Message.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Message.ts#L18)

###### Parameters

###### part

[`TextPart`](../../../chat.md#textpart)

###### index

`number`

###### Returns

`ReactNode`

##### renderToolCall()?

> `optional` **renderToolCall**: (`part`, `index`) => `ReactNode`

Defined in: [chat/react/Message.ts:20](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Message.ts#L20)

###### Parameters

###### part

[`ToolCallPart`](../../../chat.md#toolcallpart)

###### index

`number`

###### Returns

`ReactNode`

***

### ModelOption

Defined in: [chat/react/useModels.ts:5](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useModels.ts#L5)

Model display option returned by useModels (mapped from core ModelInfo).

#### Properties

##### id

> **id**: `string`

Defined in: [chat/react/useModels.ts:6](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useModels.ts#L6)

##### name

> **name**: `string`

Defined in: [chat/react/useModels.ts:7](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useModels.ts#L7)

##### provider?

> `optional` **provider**: `string`

Defined in: [chat/react/useModels.ts:10](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useModels.ts#L10)

Provider/backend name for multi-provider context.

##### tier?

> `optional` **tier**: `string`

Defined in: [chat/react/useModels.ts:8](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useModels.ts#L8)

***

### ModelSelectorProps

Defined in: [chat/react/ModelSelector.ts:13](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ModelSelector.ts#L13)

Props for the ModelSelector component.

#### Properties

##### allowFreeText?

> `optional` **allowFreeText**: `boolean`

Defined in: [chat/react/ModelSelector.ts:20](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ModelSelector.ts#L20)

Allow free-text model input when models list is empty. Default: true.

##### className?

> `optional` **className**: `string`

Defined in: [chat/react/ModelSelector.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ModelSelector.ts#L18)

##### models

> **models**: [`ModelOption`](#modeloption)[]

Defined in: [chat/react/ModelSelector.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ModelSelector.ts#L14)

##### onSelect()

> **onSelect**: (`modelId`) => `void`

Defined in: [chat/react/ModelSelector.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ModelSelector.ts#L16)

###### Parameters

###### modelId

`string`

###### Returns

`void`

##### placeholder?

> `optional` **placeholder**: `string`

Defined in: [chat/react/ModelSelector.ts:17](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ModelSelector.ts#L17)

##### selectedModel?

> `optional` **selectedModel**: `string`

Defined in: [chat/react/ModelSelector.ts:15](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ModelSelector.ts#L15)

***

### PendingToolRequest

Defined in: [chat/react/useToolApproval.ts:5](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useToolApproval.ts#L5)

A pending tool call requiring user approval.

#### Properties

##### messageId

> **messageId**: `string`

Defined in: [chat/react/useToolApproval.ts:9](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useToolApproval.ts#L9)

##### toolArgs

> **toolArgs**: `Record`\<`string`, `unknown`\>

Defined in: [chat/react/useToolApproval.ts:8](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useToolApproval.ts#L8)

##### toolCallId

> **toolCallId**: `string`

Defined in: [chat/react/useToolApproval.ts:6](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useToolApproval.ts#L6)

##### toolName

> **toolName**: `string`

Defined in: [chat/react/useToolApproval.ts:7](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useToolApproval.ts#L7)

***

### PermissionDialogProps

Defined in: [chat/react/PermissionDialog.ts:5](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/PermissionDialog.ts#L5)

Props for PermissionDialog.

#### Properties

##### className?

> `optional` **className**: `string`

Defined in: [chat/react/PermissionDialog.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/PermissionDialog.ts#L18)

##### onApprove()

> **onApprove**: (`toolCallId`) => `void`

Defined in: [chat/react/PermissionDialog.ts:9](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/PermissionDialog.ts#L9)

Called when user approves a tool call.

###### Parameters

###### toolCallId

`string`

###### Returns

`void`

##### onApproveAll()?

> `optional` **onApproveAll**: () => `void`

Defined in: [chat/react/PermissionDialog.ts:13](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/PermissionDialog.ts#L13)

Optional: approve all pending at once.

###### Returns

`void`

##### onDeny()

> **onDeny**: (`toolCallId`) => `void`

Defined in: [chat/react/PermissionDialog.ts:11](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/PermissionDialog.ts#L11)

Called when user denies a tool call.

###### Parameters

###### toolCallId

`string`

###### Returns

`void`

##### onDenyAll()?

> `optional` **onDenyAll**: () => `void`

Defined in: [chat/react/PermissionDialog.ts:15](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/PermissionDialog.ts#L15)

Optional: deny all pending at once.

###### Returns

`void`

##### renderArgs()?

> `optional` **renderArgs**: (`args`, `toolName`) => `ReactNode`

Defined in: [chat/react/PermissionDialog.ts:17](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/PermissionDialog.ts#L17)

Custom renderer for tool arguments.

###### Parameters

###### args

`Record`\<`string`, `unknown`\>

###### toolName

`string`

###### Returns

`ReactNode`

##### requests

> **requests**: [`PendingToolRequest`](#pendingtoolrequest)[]

Defined in: [chat/react/PermissionDialog.ts:7](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/PermissionDialog.ts#L7)

List of pending tool requests awaiting approval.

***

### ProviderModelItem

Defined in: [chat/react/ProviderModelSelector.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderModelSelector.ts#L14)

A unified item rendered in the ProviderModelSelector dropdown.

#### Properties

##### id

> **id**: `string`

Defined in: [chat/react/ProviderModelSelector.ts:15](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderModelSelector.ts#L15)

##### label

> **label**: `string`

Defined in: [chat/react/ProviderModelSelector.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderModelSelector.ts#L16)

##### sublabel?

> `optional` **sublabel**: `string`

Defined in: [chat/react/ProviderModelSelector.ts:17](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderModelSelector.ts#L17)

##### tier?

> `optional` **tier**: `string`

Defined in: [chat/react/ProviderModelSelector.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderModelSelector.ts#L18)

##### type

> **type**: `"model"` \| `"provider"`

Defined in: [chat/react/ProviderModelSelector.ts:19](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderModelSelector.ts#L19)

***

### ProviderModelSelectorProps

Defined in: [chat/react/ProviderModelSelector.ts:23](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderModelSelector.ts#L23)

Props for the ProviderModelSelector component.

#### Properties

##### activeProviderId?

> `optional` **activeProviderId**: `string`

Defined in: [chat/react/ProviderModelSelector.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderModelSelector.ts#L29)

Currently selected provider ID.

##### className?

> `optional` **className**: `string`

Defined in: [chat/react/ProviderModelSelector.ts:40](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderModelSelector.ts#L40)

##### models?

> `optional` **models**: [`ModelOption`](#modeloption)[]

Defined in: [chat/react/ProviderModelSelector.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderModelSelector.ts#L27)

Available models. Used when providers is empty or undefined.

##### onSelectModel()?

> `optional` **onSelectModel**: (`modelId`) => `void`

Defined in: [chat/react/ProviderModelSelector.ts:35](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderModelSelector.ts#L35)

Called when a model is selected (fallback mode).

###### Parameters

###### modelId

`string`

###### Returns

`void`

##### onSelectProvider()?

> `optional` **onSelectProvider**: (`id`) => `void`

Defined in: [chat/react/ProviderModelSelector.ts:33](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderModelSelector.ts#L33)

Called when a provider is selected.

###### Parameters

###### id

`string`

###### Returns

`void`

##### onSettingsClick()?

> `optional` **onSettingsClick**: () => `void`

Defined in: [chat/react/ProviderModelSelector.ts:37](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderModelSelector.ts#L37)

Called when settings gear is clicked.

###### Returns

`void`

##### placeholder?

> `optional` **placeholder**: `string`

Defined in: [chat/react/ProviderModelSelector.ts:39](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderModelSelector.ts#L39)

Placeholder text for the trigger button.

##### providers?

> `optional` **providers**: [`ProviderConfig`](../../../chat.md#providerconfig)[]

Defined in: [chat/react/ProviderModelSelector.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderModelSelector.ts#L25)

Configured providers (backend + model combos). When non-empty, provider mode is used.

##### selectedModel?

> `optional` **selectedModel**: `string`

Defined in: [chat/react/ProviderModelSelector.ts:31](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderModelSelector.ts#L31)

Currently selected model ID (fallback mode).

***

### ProviderSelectorProps

Defined in: [chat/react/ProviderSelector.ts:13](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderSelector.ts#L13)

Props for the ProviderSelector component.

#### Properties

##### activeProviderId?

> `optional` **activeProviderId**: `string`

Defined in: [chat/react/ProviderSelector.ts:15](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderSelector.ts#L15)

##### className?

> `optional` **className**: `string`

Defined in: [chat/react/ProviderSelector.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderSelector.ts#L18)

##### onSelect()

> **onSelect**: (`id`) => `void`

Defined in: [chat/react/ProviderSelector.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderSelector.ts#L16)

###### Parameters

###### id

`string`

###### Returns

`void`

##### onSettingsClick()?

> `optional` **onSettingsClick**: () => `void`

Defined in: [chat/react/ProviderSelector.ts:17](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderSelector.ts#L17)

###### Returns

`void`

##### providers

> **providers**: [`ProviderConfig`](../../../chat.md#providerconfig)[]

Defined in: [chat/react/ProviderSelector.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderSelector.ts#L14)

***

### ProviderSettingsProps

Defined in: [chat/react/ProviderSettings.ts:19](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderSettings.ts#L19)

Props for the ProviderSettings component.

#### Properties

##### authBaseUrl?

> `optional` **authBaseUrl**: `string`

Defined in: [chat/react/ProviderSettings.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderSettings.ts#L27)

##### className?

> `optional` **className**: `string`

Defined in: [chat/react/ProviderSettings.ts:28](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderSettings.ts#L28)

##### onAuthCompleted()?

> `optional` **onAuthCompleted**: (`backend`) => `void`

Defined in: [chat/react/ProviderSettings.ts:26](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderSettings.ts#L26)

Called when authentication succeeds (before configure step). Parent should refresh providers.

###### Parameters

###### backend

`string`

###### Returns

`void`

##### onClose()?

> `optional` **onClose**: () => `void`

Defined in: [chat/react/ProviderSettings.ts:21](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderSettings.ts#L21)

###### Returns

`void`

##### onProviderCreated()?

> `optional` **onProviderCreated**: (`p`) => `void`

Defined in: [chat/react/ProviderSettings.ts:22](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderSettings.ts#L22)

###### Parameters

###### p

[`ProviderConfig`](../../../chat.md#providerconfig)

###### Returns

`void`

##### onProviderDeleted()?

> `optional` **onProviderDeleted**: (`id`) => `void`

Defined in: [chat/react/ProviderSettings.ts:23](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderSettings.ts#L23)

###### Parameters

###### id

`string`

###### Returns

`void`

##### onProviderUpdated()?

> `optional` **onProviderUpdated**: (`id`, `changes`) => `void`

Defined in: [chat/react/ProviderSettings.ts:24](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderSettings.ts#L24)

###### Parameters

###### id

`string`

###### changes

###### label?

`string`

###### model?

`string`

###### Returns

`void`

##### providers

> **providers**: [`ProviderConfig`](../../../chat.md#providerconfig)[]

Defined in: [chat/react/ProviderSettings.ts:20](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderSettings.ts#L20)

***

### RemoteChatClientOptions

Defined in: [chat/react/RemoteChatClient.ts:48](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L48)

Standard server endpoint contract.
Server implementations expose these routes to work with RemoteChatClient.

POST   {baseUrl}/sessions/create   — Create session
GET    {baseUrl}/sessions/{id}     — Get session
GET    {baseUrl}/sessions          — List sessions
DELETE {baseUrl}/sessions/{id}     — Delete session
GET    {baseUrl}/sessions/{id}/context-stats — Get context window stats
POST   {baseUrl}/send              — Send message (SSE stream response)
POST   {baseUrl}/abort             — Abort current stream
GET    {baseUrl}/models            — List models
GET    {baseUrl}/backends          — List backends
POST   {baseUrl}/model/switch      — Switch model
POST   {baseUrl}/provider/switch   — Switch provider (backend + model)
GET    {baseUrl}/providers         — List providers
POST   {baseUrl}/providers         — Create provider
PUT    {baseUrl}/providers/{id}    — Update provider
DELETE {baseUrl}/providers/{id}    — Delete provider

#### Properties

##### baseUrl

> **baseUrl**: `string`

Defined in: [chat/react/RemoteChatClient.ts:50](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L50)

Base URL for API endpoints (e.g. "/api" or "https://example.com/api")

##### fetch()?

> `optional` **fetch**: \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

Defined in: [chat/react/RemoteChatClient.ts:54](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L54)

Custom fetch implementation for testability

###### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

###### Parameters

###### input

`URL` | `RequestInfo`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

###### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

###### Parameters

###### input

`string` | `URL` | `Request`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

##### headers?

> `optional` **headers**: `Record`\<`string`, `string`\>

Defined in: [chat/react/RemoteChatClient.ts:52](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/RemoteChatClient.ts#L52)

Optional headers for all requests (e.g. auth tokens)

***

### ThinkingBlockProps

Defined in: [chat/react/ThinkingBlock.ts:4](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThinkingBlock.ts#L4)

Props for the ThinkingBlock component.

#### Properties

##### defaultOpen?

> `optional` **defaultOpen**: `boolean`

Defined in: [chat/react/ThinkingBlock.ts:7](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThinkingBlock.ts#L7)

##### isStreaming?

> `optional` **isStreaming**: `boolean`

Defined in: [chat/react/ThinkingBlock.ts:6](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThinkingBlock.ts#L6)

##### text

> **text**: `string`

Defined in: [chat/react/ThinkingBlock.ts:5](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThinkingBlock.ts#L5)

***

### ThreadListProps

Defined in: [chat/react/ThreadList.ts:45](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadList.ts#L45)

Props for the ThreadList component.

#### Properties

##### activeSessionId?

> `optional` **activeSessionId**: `string`

Defined in: [chat/react/ThreadList.ts:47](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadList.ts#L47)

##### className?

> `optional` **className**: `string`

Defined in: [chat/react/ThreadList.ts:53](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadList.ts#L53)

##### onCreate()?

> `optional` **onCreate**: () => `void`

Defined in: [chat/react/ThreadList.ts:49](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadList.ts#L49)

###### Returns

`void`

##### onDelete()?

> `optional` **onDelete**: (`id`) => `void`

Defined in: [chat/react/ThreadList.ts:50](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadList.ts#L50)

###### Parameters

###### id

`string`

###### Returns

`void`

##### onSearchChange()?

> `optional` **onSearchChange**: (`query`) => `void`

Defined in: [chat/react/ThreadList.ts:52](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadList.ts#L52)

###### Parameters

###### query

`string`

###### Returns

`void`

##### onSelect()

> **onSelect**: (`id`) => `void`

Defined in: [chat/react/ThreadList.ts:48](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadList.ts#L48)

###### Parameters

###### id

`string`

###### Returns

`void`

##### searchQuery?

> `optional` **searchQuery**: `string`

Defined in: [chat/react/ThreadList.ts:51](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadList.ts#L51)

##### sessions

> **sessions**: `SessionItem`[]

Defined in: [chat/react/ThreadList.ts:46](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadList.ts#L46)

***

### ThreadProps

Defined in: [chat/react/Thread.ts:15](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Thread.ts#L15)

Props for the Thread component.

#### Properties

##### autoScroll?

> `optional` **autoScroll**: `boolean`

Defined in: [chat/react/Thread.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Thread.ts#L18)

##### className?

> `optional` **className**: `string`

Defined in: [chat/react/Thread.ts:19](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Thread.ts#L19)

##### isGenerating?

> `optional` **isGenerating**: `boolean`

Defined in: [chat/react/Thread.ts:17](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Thread.ts#L17)

##### messages

> **messages**: [`ChatMessage`](../../../chat.md#chatmessage)\<`unknown`\>[]

Defined in: [chat/react/Thread.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Thread.ts#L16)

##### virtualize?

> `optional` **virtualize**: `boolean` \| [`VirtualizeOptions`](#virtualizeoptions)

Defined in: [chat/react/Thread.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Thread.ts#L25)

Enable windowed rendering for large message lists.
Pass `true` for defaults or an options object.
When enabled, only visible messages (plus overscan) are mounted.

***

### ThreadProviderProps

Defined in: [chat/react/ThreadSlots.ts:19](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadSlots.ts#L19)

Props for ThreadProvider.

#### Extends

- [`ThreadSlotOverrides`](#threadslotoverrides)

#### Properties

##### children

> **children**: `ReactNode`

Defined in: [chat/react/ThreadSlots.ts:20](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadSlots.ts#L20)

##### renderMessage()?

> `optional` **renderMessage**: (`message`, `index`) => `ReactNode`

Defined in: [chat/react/ThreadSlots.ts:11](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadSlots.ts#L11)

###### Parameters

###### message

[`ChatMessage`](../../../chat.md#chatmessage)

###### index

`number`

###### Returns

`ReactNode`

###### Inherited from

[`ThreadSlotOverrides`](#threadslotoverrides).[`renderMessage`](#rendermessage-2)

##### renderThinkingBlock()?

> `optional` **renderThinkingBlock**: (`part`, `index`) => `ReactNode`

Defined in: [chat/react/ThreadSlots.ts:13](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadSlots.ts#L13)

###### Parameters

###### part

[`ReasoningPart`](../../../chat.md#reasoningpart)

###### index

`number`

###### Returns

`ReactNode`

###### Inherited from

[`ThreadSlotOverrides`](#threadslotoverrides).[`renderThinkingBlock`](#renderthinkingblock-2)

##### renderToolCall()?

> `optional` **renderToolCall**: (`part`, `index`) => `ReactNode`

Defined in: [chat/react/ThreadSlots.ts:12](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadSlots.ts#L12)

###### Parameters

###### part

[`ToolCallPart`](../../../chat.md#toolcallpart)

###### index

`number`

###### Returns

`ReactNode`

###### Inherited from

[`ThreadSlotOverrides`](#threadslotoverrides).[`renderToolCall`](#rendertoolcall-3)

***

### ThreadSlotOverrides

Defined in: [chat/react/ThreadSlots.ts:10](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadSlots.ts#L10)

Slot override functions for Thread customization.

#### Extended by

- [`ThreadProviderProps`](#threadproviderprops)

#### Properties

##### renderMessage()?

> `optional` **renderMessage**: (`message`, `index`) => `ReactNode`

Defined in: [chat/react/ThreadSlots.ts:11](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadSlots.ts#L11)

###### Parameters

###### message

[`ChatMessage`](../../../chat.md#chatmessage)

###### index

`number`

###### Returns

`ReactNode`

##### renderThinkingBlock()?

> `optional` **renderThinkingBlock**: (`part`, `index`) => `ReactNode`

Defined in: [chat/react/ThreadSlots.ts:13](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadSlots.ts#L13)

###### Parameters

###### part

[`ReasoningPart`](../../../chat.md#reasoningpart)

###### index

`number`

###### Returns

`ReactNode`

##### renderToolCall()?

> `optional` **renderToolCall**: (`part`, `index`) => `ReactNode`

Defined in: [chat/react/ThreadSlots.ts:12](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadSlots.ts#L12)

###### Parameters

###### part

[`ToolCallPart`](../../../chat.md#toolcallpart)

###### index

`number`

###### Returns

`ReactNode`

***

### ToolCallViewProps

Defined in: [chat/react/ToolCallView.ts:5](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ToolCallView.ts#L5)

Props for the ToolCallView component.

#### Properties

##### onApprove()?

> `optional` **onApprove**: () => `void`

Defined in: [chat/react/ToolCallView.ts:7](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ToolCallView.ts#L7)

###### Returns

`void`

##### onDeny()?

> `optional` **onDeny**: () => `void`

Defined in: [chat/react/ToolCallView.ts:8](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ToolCallView.ts#L8)

###### Returns

`void`

##### part

> **part**: [`ToolCallPart`](../../../chat.md#toolcallpart)

Defined in: [chat/react/ToolCallView.ts:6](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ToolCallView.ts#L6)

##### renderArgs()?

> `optional` **renderArgs**: (`args`) => `ReactNode`

Defined in: [chat/react/ToolCallView.ts:9](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ToolCallView.ts#L9)

###### Parameters

###### args

`unknown`

###### Returns

`ReactNode`

##### renderResult()?

> `optional` **renderResult**: (`result`) => `ReactNode`

Defined in: [chat/react/ToolCallView.ts:10](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ToolCallView.ts#L10)

###### Parameters

###### result

`unknown`

###### Returns

`ReactNode`

***

### UsageBadgeProps

Defined in: [chat/react/UsageBadge.ts:5](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/UsageBadge.ts#L5)

Props for the UsageBadge component.

#### Properties

##### className?

> `optional` **className**: `string`

Defined in: [chat/react/UsageBadge.ts:7](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/UsageBadge.ts#L7)

##### usage

> **usage**: [`ChatUsage`](#chatusage) \| `null`

Defined in: [chat/react/UsageBadge.ts:6](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/UsageBadge.ts#L6)

***

### UseApiKeyAuthOptions

Defined in: [chat/react/auth/useApiKeyAuth.ts:12](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useApiKeyAuth.ts#L12)

Options for useApiKeyAuth.

#### Properties

##### baseUrl

> **baseUrl**: `string`

Defined in: [chat/react/auth/useApiKeyAuth.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useApiKeyAuth.ts#L14)

Base URL of the auth server (e.g. "/api/auth")

##### fetch()?

> `optional` **fetch**: \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

Defined in: [chat/react/auth/useApiKeyAuth.ts:20](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useApiKeyAuth.ts#L20)

Optional fetch override (for testing)

###### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

###### Parameters

###### input

`URL` | `RequestInfo`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

###### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

###### Parameters

###### input

`string` | `URL` | `Request`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

##### headers?

> `optional` **headers**: `Record`\<`string`, `string`\>

Defined in: [chat/react/auth/useApiKeyAuth.ts:22](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useApiKeyAuth.ts#L22)

Optional headers for all requests

##### onAuthenticated()?

> `optional` **onAuthenticated**: (`token`) => `void`

Defined in: [chat/react/auth/useApiKeyAuth.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useApiKeyAuth.ts#L16)

Called after successful authentication

###### Parameters

###### token

[`AuthToken`](../../../auth.md#authtoken)

###### Returns

`void`

##### onError()?

> `optional` **onError**: (`error`) => `void`

Defined in: [chat/react/auth/useApiKeyAuth.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useApiKeyAuth.ts#L18)

Called on authentication error

###### Parameters

###### error

`Error`

###### Returns

`void`

***

### UseApiKeyAuthReturn

Defined in: [chat/react/auth/useApiKeyAuth.ts:26](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useApiKeyAuth.ts#L26)

Return value from useApiKeyAuth.

#### Properties

##### error

> **error**: `Error` \| `null`

Defined in: [chat/react/auth/useApiKeyAuth.ts:28](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useApiKeyAuth.ts#L28)

##### reset()

> **reset**: () => `void`

Defined in: [chat/react/auth/useApiKeyAuth.ts:32](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useApiKeyAuth.ts#L32)

###### Returns

`void`

##### status

> **status**: `"error"` \| `"idle"` \| `"pending"` \| `"authenticated"`

Defined in: [chat/react/auth/useApiKeyAuth.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useApiKeyAuth.ts#L27)

##### submit()

> **submit**: (`key`, `apiBaseUrl?`) => `Promise`\<`void`\>

Defined in: [chat/react/auth/useApiKeyAuth.ts:31](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useApiKeyAuth.ts#L31)

Submit an API key (and optional provider base URL).

###### Parameters

###### key

`string`

###### apiBaseUrl?

`string`

###### Returns

`Promise`\<`void`\>

##### token

> **token**: [`AuthToken`](../../../auth.md#authtoken) \| `null`

Defined in: [chat/react/auth/useApiKeyAuth.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useApiKeyAuth.ts#L29)

***

### UseBackendsReturn

Defined in: [chat/react/useBackends.ts:6](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useBackends.ts#L6)

Return type for the useBackends hook.

#### Properties

##### backends

> **backends**: [`BackendInfo`](../../../chat/runtime.md#backendinfo)[]

Defined in: [chat/react/useBackends.ts:7](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useBackends.ts#L7)

##### error

> **error**: `Error` \| `null`

Defined in: [chat/react/useBackends.ts:9](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useBackends.ts#L9)

##### isLoading

> **isLoading**: `boolean`

Defined in: [chat/react/useBackends.ts:8](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useBackends.ts#L8)

##### refresh()

> **refresh**: () => `void`

Defined in: [chat/react/useBackends.ts:10](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useBackends.ts#L10)

###### Returns

`void`

***

### UseChatOptions

Defined in: [chat/react/useChat.ts:8](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L8)

Options for the useChat hook.

#### Properties

##### autoDismissMs?

> `optional` **autoDismissMs**: `number`

Defined in: [chat/react/useChat.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L14)

Auto-dismiss errors after this many ms (0 = disabled, default: 0).

##### onError()?

> `optional` **onError**: (`error`) => `void`

Defined in: [chat/react/useChat.ts:12](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L12)

Called on error during send.

###### Parameters

###### error

`Error`

###### Returns

`void`

##### sessionId?

> `optional` **sessionId**: `string`

Defined in: [chat/react/useChat.ts:10](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L10)

Session ID. If omitted, a new session is created on first send.

***

### UseChatReturn

Defined in: [chat/react/useChat.ts:26](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L26)

Return value from useChat.

#### Properties

##### clearError()

> **clearError**: () => `void`

Defined in: [chat/react/useChat.ts:42](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L42)

Clear the error state.

###### Returns

`void`

##### error

> **error**: `Error` \| `null`

Defined in: [chat/react/useChat.ts:40](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L40)

Current error, if any.

##### isGenerating

> **isGenerating**: `boolean`

Defined in: [chat/react/useChat.ts:36](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L36)

Whether the assistant is currently generating.

##### messages

> **messages**: [`ChatMessage`](../../../chat.md#chatmessage)\<`unknown`\>[]

Defined in: [chat/react/useChat.ts:30](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L30)

Ordered messages in the current session.

##### newSession()

> **newSession**: () => `Promise`\<`string`\>

Defined in: [chat/react/useChat.ts:46](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L46)

Create a new session, resetting messages.

###### Returns

`Promise`\<`string`\>

##### retryLastMessage()

> **retryLastMessage**: () => `Promise`\<`void`\>

Defined in: [chat/react/useChat.ts:44](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L44)

Retry the last failed message. No-op if no error or no last user message.

###### Returns

`Promise`\<`void`\>

##### sendMessage()

> **sendMessage**: (`content`) => `Promise`\<`void`\>

Defined in: [chat/react/useChat.ts:32](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L32)

Send a user message and trigger assistant response.

###### Parameters

###### content

`string`

###### Returns

`Promise`\<`void`\>

##### sessionId

> **sessionId**: `string` \| `null`

Defined in: [chat/react/useChat.ts:28](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L28)

Current session ID (null until session created).

##### status

> **status**: [`RuntimeStatus`](../../../chat.md#runtimestatus)

Defined in: [chat/react/useChat.ts:38](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L38)

Current runtime status.

##### stop()

> **stop**: () => `void`

Defined in: [chat/react/useChat.ts:34](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L34)

Abort the current generation.

###### Returns

`void`

##### usage

> **usage**: [`ChatUsage`](#chatusage) \| `null`

Defined in: [chat/react/useChat.ts:48](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L48)

Token usage from the last completed response.

***

### UseClaudeAuthOptions

Defined in: [chat/react/auth/useClaudeAuth.ts:12](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useClaudeAuth.ts#L12)

Options for useClaudeAuth.

#### Properties

##### baseUrl

> **baseUrl**: `string`

Defined in: [chat/react/auth/useClaudeAuth.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useClaudeAuth.ts#L14)

Base URL of the auth server (e.g. "/api/auth")

##### fetch()?

> `optional` **fetch**: \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

Defined in: [chat/react/auth/useClaudeAuth.ts:20](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useClaudeAuth.ts#L20)

Optional fetch override (for testing)

###### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

###### Parameters

###### input

`URL` | `RequestInfo`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

###### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

###### Parameters

###### input

`string` | `URL` | `Request`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

##### headers?

> `optional` **headers**: `Record`\<`string`, `string`\>

Defined in: [chat/react/auth/useClaudeAuth.ts:22](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useClaudeAuth.ts#L22)

Optional headers for all requests

##### onAuthenticated()?

> `optional` **onAuthenticated**: (`token`) => `void`

Defined in: [chat/react/auth/useClaudeAuth.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useClaudeAuth.ts#L16)

Called after successful authentication

###### Parameters

###### token

[`AuthToken`](../../../auth.md#authtoken)

###### Returns

`void`

##### onError()?

> `optional` **onError**: (`error`) => `void`

Defined in: [chat/react/auth/useClaudeAuth.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useClaudeAuth.ts#L18)

Called on authentication error

###### Parameters

###### error

`Error`

###### Returns

`void`

***

### UseClaudeAuthReturn

Defined in: [chat/react/auth/useClaudeAuth.ts:26](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useClaudeAuth.ts#L26)

Return value from useClaudeAuth.

#### Properties

##### authorizeUrl

> **authorizeUrl**: `string` \| `null`

Defined in: [chat/react/auth/useClaudeAuth.ts:30](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useClaudeAuth.ts#L30)

##### complete()

> **complete**: (`codeOrUrl`) => `Promise`\<`void`\>

Defined in: [chat/react/auth/useClaudeAuth.ts:34](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useClaudeAuth.ts#L34)

Complete OAuth after redirect. Pass the code or callback URL.

###### Parameters

###### codeOrUrl

`string`

###### Returns

`Promise`\<`void`\>

##### error

> **error**: `Error` \| `null`

Defined in: [chat/react/auth/useClaudeAuth.ts:28](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useClaudeAuth.ts#L28)

##### reset()

> **reset**: () => `void`

Defined in: [chat/react/auth/useClaudeAuth.ts:35](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useClaudeAuth.ts#L35)

###### Returns

`void`

##### start()

> **start**: () => `Promise`\<`void`\>

Defined in: [chat/react/auth/useClaudeAuth.ts:32](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useClaudeAuth.ts#L32)

Start OAuth flow. Sets authorizeUrl for user redirect.

###### Returns

`Promise`\<`void`\>

##### status

> **status**: `"error"` \| `"idle"` \| `"pending"` \| `"authenticated"`

Defined in: [chat/react/auth/useClaudeAuth.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useClaudeAuth.ts#L27)

##### token

> **token**: [`AuthToken`](../../../auth.md#authtoken) \| `null`

Defined in: [chat/react/auth/useClaudeAuth.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useClaudeAuth.ts#L29)

***

### UseCopilotAuthOptions

Defined in: [chat/react/auth/useCopilotAuth.ts:12](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useCopilotAuth.ts#L12)

Options for useCopilotAuth.

#### Properties

##### baseUrl

> **baseUrl**: `string`

Defined in: [chat/react/auth/useCopilotAuth.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useCopilotAuth.ts#L14)

Base URL of the auth server (e.g. "/api/auth")

##### fetch()?

> `optional` **fetch**: \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

Defined in: [chat/react/auth/useCopilotAuth.ts:20](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useCopilotAuth.ts#L20)

Optional fetch override (for testing)

###### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

###### Parameters

###### input

`URL` | `RequestInfo`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

###### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

###### Parameters

###### input

`string` | `URL` | `Request`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

##### headers?

> `optional` **headers**: `Record`\<`string`, `string`\>

Defined in: [chat/react/auth/useCopilotAuth.ts:22](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useCopilotAuth.ts#L22)

Optional headers for all requests

##### onAuthenticated()?

> `optional` **onAuthenticated**: (`token`) => `void`

Defined in: [chat/react/auth/useCopilotAuth.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useCopilotAuth.ts#L16)

Called after successful authentication

###### Parameters

###### token

[`AuthToken`](../../../auth.md#authtoken)

###### Returns

`void`

##### onError()?

> `optional` **onError**: (`error`) => `void`

Defined in: [chat/react/auth/useCopilotAuth.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useCopilotAuth.ts#L18)

Called on authentication error

###### Parameters

###### error

`Error`

###### Returns

`void`

***

### UseCopilotAuthReturn

Defined in: [chat/react/auth/useCopilotAuth.ts:26](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useCopilotAuth.ts#L26)

Return value from useCopilotAuth.

#### Properties

##### deviceCode

> **deviceCode**: `string` \| `null`

Defined in: [chat/react/auth/useCopilotAuth.ts:30](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useCopilotAuth.ts#L30)

##### error

> **error**: `Error` \| `null`

Defined in: [chat/react/auth/useCopilotAuth.ts:28](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useCopilotAuth.ts#L28)

##### reset()

> **reset**: () => `void`

Defined in: [chat/react/auth/useCopilotAuth.ts:34](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useCopilotAuth.ts#L34)

###### Returns

`void`

##### start()

> **start**: () => `Promise`\<`void`\>

Defined in: [chat/react/auth/useCopilotAuth.ts:33](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useCopilotAuth.ts#L33)

Start the device flow. Shows deviceCode and verificationUrl, then polls for completion.

###### Returns

`Promise`\<`void`\>

##### status

> **status**: `"error"` \| `"idle"` \| `"pending"` \| `"authenticated"`

Defined in: [chat/react/auth/useCopilotAuth.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useCopilotAuth.ts#L27)

##### token

> **token**: [`AuthToken`](../../../auth.md#authtoken) \| `null`

Defined in: [chat/react/auth/useCopilotAuth.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useCopilotAuth.ts#L29)

##### verificationUrl

> **verificationUrl**: `string` \| `null`

Defined in: [chat/react/auth/useCopilotAuth.ts:31](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useCopilotAuth.ts#L31)

***

### UseMessagesOptions

Defined in: [chat/react/useMessages.ts:7](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useMessages.ts#L7)

Options for the useMessages hook.

#### Properties

##### sessionId

> **sessionId**: `string`

Defined in: [chat/react/useMessages.ts:9](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useMessages.ts#L9)

Session ID to observe.

***

### UseMessagesReturn

Defined in: [chat/react/useMessages.ts:13](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useMessages.ts#L13)

Return value from useMessages.

#### Properties

##### isLoaded

> **isLoaded**: `boolean`

Defined in: [chat/react/useMessages.ts:17](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useMessages.ts#L17)

Whether the session was found.

##### messages

> **messages**: [`ChatMessage`](../../../chat.md#chatmessage)\<`unknown`\>[]

Defined in: [chat/react/useMessages.ts:15](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useMessages.ts#L15)

Ordered messages in the session.

***

### UseModelsReturn

Defined in: [chat/react/useModels.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useModels.ts#L14)

Return type for the useModels hook.

#### Properties

##### error

> **error**: `Error` \| `null`

Defined in: [chat/react/useModels.ts:17](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useModels.ts#L17)

##### isLoading

> **isLoading**: `boolean`

Defined in: [chat/react/useModels.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useModels.ts#L16)

##### models

> **models**: [`ModelOption`](#modeloption)[]

Defined in: [chat/react/useModels.ts:15](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useModels.ts#L15)

##### refresh()

> **refresh**: () => `void`

Defined in: [chat/react/useModels.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useModels.ts#L18)

###### Returns

`void`

##### search()

> **search**: (`query`) => [`ModelOption`](#modeloption)[]

Defined in: [chat/react/useModels.ts:19](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useModels.ts#L19)

###### Parameters

###### query

`string`

###### Returns

[`ModelOption`](#modeloption)[]

***

### UseProvidersReturn

Defined in: [chat/react/useProviders.ts:24](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useProviders.ts#L24)

Return type for the useProviders hook.

#### Properties

##### createProvider()

> **createProvider**: (`config`) => `Promise`\<`void`\>

Defined in: [chat/react/useProviders.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useProviders.ts#L29)

###### Parameters

###### config

`Omit`\<[`ProviderConfig`](../../../chat.md#providerconfig), `"id"` \| `"createdAt"`\>

###### Returns

`Promise`\<`void`\>

##### deleteProvider()

> **deleteProvider**: (`id`) => `Promise`\<`void`\>

Defined in: [chat/react/useProviders.ts:31](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useProviders.ts#L31)

###### Parameters

###### id

`string`

###### Returns

`Promise`\<`void`\>

##### error

> **error**: `Error` \| `null`

Defined in: [chat/react/useProviders.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useProviders.ts#L27)

##### isLoading

> **isLoading**: `boolean`

Defined in: [chat/react/useProviders.ts:26](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useProviders.ts#L26)

##### providers

> **providers**: [`ProviderConfig`](../../../chat.md#providerconfig)[]

Defined in: [chat/react/useProviders.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useProviders.ts#L25)

##### refresh()

> **refresh**: () => `void`

Defined in: [chat/react/useProviders.ts:28](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useProviders.ts#L28)

###### Returns

`void`

##### selectProvider()

> **selectProvider**: (`id`) => `void`

Defined in: [chat/react/useProviders.ts:32](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useProviders.ts#L32)

###### Parameters

###### id

`string`

###### Returns

`void`

##### updateProvider()

> **updateProvider**: (`id`, `changes`) => `Promise`\<`void`\>

Defined in: [chat/react/useProviders.ts:30](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useProviders.ts#L30)

###### Parameters

###### id

`string`

###### changes

`Partial`\<`Omit`\<[`ProviderConfig`](../../../chat.md#providerconfig), `"id"` \| `"createdAt"`\>\>

###### Returns

`Promise`\<`void`\>

***

### UseRemoteAuthOptions

Defined in: [chat/react/useRemoteAuth.ts:24](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L24)

Options for the useRemoteAuth hook.

#### Properties

##### backend

> **backend**: [`RemoteAuthBackend`](#remoteauthbackend)

Defined in: [chat/react/useRemoteAuth.ts:26](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L26)

Auth backend to use

##### baseUrl

> **baseUrl**: `string`

Defined in: [chat/react/useRemoteAuth.ts:28](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L28)

Base URL of the auth server (e.g. "http://localhost:3456/api/auth")

##### fetch()?

> `optional` **fetch**: \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

Defined in: [chat/react/useRemoteAuth.ts:32](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L32)

Optional fetch override (for testing)

###### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

###### Parameters

###### input

`URL` | `RequestInfo`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

###### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

###### Parameters

###### input

`string` | `URL` | `Request`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

##### headers?

> `optional` **headers**: `Record`\<`string`, `string`\>

Defined in: [chat/react/useRemoteAuth.ts:34](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L34)

Optional headers for all requests

##### onAuthenticated()?

> `optional` **onAuthenticated**: (`token`) => `void`

Defined in: [chat/react/useRemoteAuth.ts:30](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L30)

Called after successful authentication

###### Parameters

###### token

[`AuthToken`](../../../auth.md#authtoken)

###### Returns

`void`

***

### UseRemoteAuthReturn

Defined in: [chat/react/useRemoteAuth.ts:38](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L38)

Return value from useRemoteAuth.

#### Properties

##### authorizeUrl

> **authorizeUrl**: `string` \| `null`

Defined in: [chat/react/useRemoteAuth.ts:47](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L47)

##### clearTokens()

> **clearTokens**: () => `Promise`\<`void`\>

Defined in: [chat/react/useRemoteAuth.ts:60](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L60)

###### Returns

`Promise`\<`void`\>

##### completeOAuth()

> **completeOAuth**: (`codeOrUrl`) => `Promise`\<`void`\>

Defined in: [chat/react/useRemoteAuth.ts:48](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L48)

###### Parameters

###### codeOrUrl

`string`

###### Returns

`Promise`\<`void`\>

##### deviceCode

> **deviceCode**: `string` \| `null`

Defined in: [chat/react/useRemoteAuth.ts:43](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L43)

##### error

> **error**: `Error` \| `null`

Defined in: [chat/react/useRemoteAuth.ts:40](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L40)

##### loadSavedTokens()

> **loadSavedTokens**: () => `Promise`\<`void`\>

Defined in: [chat/react/useRemoteAuth.ts:58](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L58)

###### Returns

`Promise`\<`void`\>

##### reset()

> **reset**: () => `void`

Defined in: [chat/react/useRemoteAuth.ts:55](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L55)

###### Returns

`void`

##### savedProviders

> **savedProviders**: `string`[]

Defined in: [chat/react/useRemoteAuth.ts:57](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L57)

##### start()

> **start**: (`provider?`) => `Promise`\<`void`\>

Defined in: [chat/react/useRemoteAuth.ts:52](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L52)

###### Parameters

###### provider?

[`RemoteAuthBackend`](#remoteauthbackend)

###### Returns

`Promise`\<`void`\>

##### startDeviceFlow()

> **startDeviceFlow**: () => `Promise`\<`void`\>

Defined in: [chat/react/useRemoteAuth.ts:42](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L42)

###### Returns

`Promise`\<`void`\>

##### startOAuthFlow()

> **startOAuthFlow**: () => `Promise`\<`void`\>

Defined in: [chat/react/useRemoteAuth.ts:46](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L46)

###### Returns

`Promise`\<`void`\>

##### status

> **status**: [`RemoteAuthStatus`](#remoteauthstatus)

Defined in: [chat/react/useRemoteAuth.ts:39](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L39)

##### submitApiKey()

> **submitApiKey**: (`key`, `baseUrl?`) => `Promise`\<`void`\>

Defined in: [chat/react/useRemoteAuth.ts:50](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L50)

###### Parameters

###### key

`string`

###### baseUrl?

`string`

###### Returns

`Promise`\<`void`\>

##### token

> **token**: [`AuthToken`](../../../auth.md#authtoken) \| `null`

Defined in: [chat/react/useRemoteAuth.ts:54](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L54)

##### useSavedToken()

> **useSavedToken**: (`provider`) => `Promise`\<`void`\>

Defined in: [chat/react/useRemoteAuth.ts:59](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L59)

###### Parameters

###### provider

[`RemoteAuthBackend`](#remoteauthbackend)

###### Returns

`Promise`\<`void`\>

##### verificationUrl

> **verificationUrl**: `string` \| `null`

Defined in: [chat/react/useRemoteAuth.ts:44](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L44)

***

### UseRemoteChatOptions

Defined in: [chat/react/useRemoteChat.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteChat.ts#L27)

Options for useRemoteChat.

#### Properties

##### authBaseUrl

> **authBaseUrl**: `string`

Defined in: [chat/react/useRemoteChat.ts:31](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteChat.ts#L31)

Base URL for auth API (e.g. "/api/auth").

##### backend

> **backend**: [`RemoteAuthBackend`](#remoteauthbackend)

Defined in: [chat/react/useRemoteChat.ts:33](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteChat.ts#L33)

Auth backend to use.

##### chatBaseUrl

> **chatBaseUrl**: `string`

Defined in: [chat/react/useRemoteChat.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteChat.ts#L29)

Base URL for chat API (e.g. "/api/chat").

##### fetch()?

> `optional` **fetch**: \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

Defined in: [chat/react/useRemoteChat.ts:37](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteChat.ts#L37)

Custom fetch for testability.

###### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

###### Parameters

###### input

`URL` | `RequestInfo`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

###### Call Signature

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

###### Parameters

###### input

`string` | `URL` | `Request`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

##### headers?

> `optional` **headers**: `Record`\<`string`, `string`\>

Defined in: [chat/react/useRemoteChat.ts:39](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteChat.ts#L39)

Optional headers for all requests.

##### onReady()?

> `optional` **onReady**: () => `void`

Defined in: [chat/react/useRemoteChat.ts:35](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteChat.ts#L35)

Called when lifecycle reaches "ready" phase.

###### Returns

`void`

***

### UseRemoteChatReturn

Defined in: [chat/react/useRemoteChat.ts:43](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteChat.ts#L43)

Return value from useRemoteChat.

#### Properties

##### auth

> **auth**: [`UseRemoteAuthReturn`](#useremoteauthreturn)

Defined in: [chat/react/useRemoteChat.ts:51](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteChat.ts#L51)

Auth sub-hook for manual auth control.

##### error

> **error**: `Error` \| `null`

Defined in: [chat/react/useRemoteChat.ts:53](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteChat.ts#L53)

Current error (null when no error).

##### logout()

> **logout**: () => `Promise`\<`void`\>

Defined in: [chat/react/useRemoteChat.ts:57](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteChat.ts#L57)

Logout: clear tokens, dispose runtime, reset to unauthenticated.

###### Returns

`Promise`\<`void`\>

##### newSession()

> **newSession**: () => `Promise`\<`string`\>

Defined in: [chat/react/useRemoteChat.ts:55](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteChat.ts#L55)

Create a new chat session. Returns session ID.

###### Returns

`Promise`\<`string`\>

##### phase

> **phase**: [`RemoteChatPhase`](#remotechatphase)

Defined in: [chat/react/useRemoteChat.ts:45](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteChat.ts#L45)

Current lifecycle phase.

##### runtime

> **runtime**: [`IChatClient`](../../../chat/runtime.md#ichatclient)\<`Record`\<`string`, `unknown`\>\> \| `null`

Defined in: [chat/react/useRemoteChat.ts:47](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteChat.ts#L47)

Chat client (null until phase = "ready").

##### sessionId

> **sessionId**: `string` \| `null`

Defined in: [chat/react/useRemoteChat.ts:49](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteChat.ts#L49)

Initial session ID (null until phase = "ready").

***

### UseSessionsReturn

Defined in: [chat/react/useSessions.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSessions.ts#L14)

Return type of useSessions hook.

#### Properties

##### error

> **error**: `Error` \| `null`

Defined in: [chat/react/useSessions.ts:20](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSessions.ts#L20)

Last error from session fetch

##### loading

> **loading**: `boolean`

Defined in: [chat/react/useSessions.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSessions.ts#L18)

Whether initial load or refresh is in progress

##### refresh()

> **refresh**: () => `void`

Defined in: [chat/react/useSessions.ts:22](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSessions.ts#L22)

Manually trigger a refresh

###### Returns

`void`

##### sessions

> **sessions**: [`SessionInfo`](../../../chat.md#sessioninfo)[]

Defined in: [chat/react/useSessions.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSessions.ts#L16)

Current session list (lightweight SessionInfo format)

***

### UseSSEOptions

Defined in: [chat/react/useSSE.ts:8](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSSE.ts#L8)

Options for the useSSE hook.

#### Properties

##### body?

> `optional` **body**: `unknown`

Defined in: [chat/react/useSSE.ts:12](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSSE.ts#L12)

Request body for POST requests (JSON-serialized automatically)

##### headers?

> `optional` **headers**: `Record`\<`string`, `string`\>

Defined in: [chat/react/useSSE.ts:13](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSSE.ts#L13)

##### method?

> `optional` **method**: `"POST"` \| `"GET"`

Defined in: [chat/react/useSSE.ts:10](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSSE.ts#L10)

HTTP method (default: "GET")

##### onError()?

> `optional` **onError**: (`error`) => `void`

Defined in: [chat/react/useSSE.ts:15](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSSE.ts#L15)

###### Parameters

###### error

`Error`

###### Returns

`void`

##### onEvent()?

> `optional` **onEvent**: (`event`) => `void`

Defined in: [chat/react/useSSE.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSSE.ts#L14)

###### Parameters

###### event

[`ChatEvent`](../../../chat.md#chatevent)

###### Returns

`void`

##### reconnect?

> `optional` **reconnect**: `boolean`

Defined in: [chat/react/useSSE.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSSE.ts#L16)

##### reconnectInterval?

> `optional` **reconnectInterval**: `number`

Defined in: [chat/react/useSSE.ts:17](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSSE.ts#L17)

***

### UseSSEReturn

Defined in: [chat/react/useSSE.ts:21](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSSE.ts#L21)

Return type for the useSSE hook.

#### Properties

##### connect()

> **connect**: () => `void`

Defined in: [chat/react/useSSE.ts:23](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSSE.ts#L23)

###### Returns

`void`

##### disconnect()

> **disconnect**: () => `void`

Defined in: [chat/react/useSSE.ts:24](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSSE.ts#L24)

###### Returns

`void`

##### lastEvent

> **lastEvent**: [`ChatEvent`](../../../chat.md#chatevent) \| `null`

Defined in: [chat/react/useSSE.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSSE.ts#L25)

##### status

> **status**: [`SSEStatus`](#ssestatus)

Defined in: [chat/react/useSSE.ts:22](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSSE.ts#L22)

***

### UseToolApprovalReturn

Defined in: [chat/react/useToolApproval.ts:13](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useToolApproval.ts#L13)

Return value from useToolApproval.

#### Properties

##### approve()

> **approve**: (`toolCallId`) => `void`

Defined in: [chat/react/useToolApproval.ts:15](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useToolApproval.ts#L15)

###### Parameters

###### toolCallId

`string`

###### Returns

`void`

##### deny()

> **deny**: (`toolCallId`) => `void`

Defined in: [chat/react/useToolApproval.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useToolApproval.ts#L16)

###### Parameters

###### toolCallId

`string`

###### Returns

`void`

##### pendingRequests

> **pendingRequests**: [`PendingToolRequest`](#pendingtoolrequest)[]

Defined in: [chat/react/useToolApproval.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useToolApproval.ts#L14)

***

### VirtualizeOptions

Defined in: [chat/react/useVirtualMessages.ts:4](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useVirtualMessages.ts#L4)

Configuration for message list virtualization.

#### Properties

##### estimatedItemHeight?

> `optional` **estimatedItemHeight**: `number`

Defined in: [chat/react/useVirtualMessages.ts:6](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useVirtualMessages.ts#L6)

Estimated height of each message item in pixels (default: 80).

##### overscan?

> `optional` **overscan**: `number`

Defined in: [chat/react/useVirtualMessages.ts:8](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useVirtualMessages.ts#L8)

Number of extra items to render above and below the visible area (default: 3).

***

### VirtualMessagesResult

Defined in: [chat/react/useVirtualMessages.ts:12](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useVirtualMessages.ts#L12)

Result of the useVirtualMessages hook.

#### Type Parameters

##### T

`T`

#### Properties

##### bottomSpacerHeight

> **bottomSpacerHeight**: `number`

Defined in: [chat/react/useVirtualMessages.ts:22](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useVirtualMessages.ts#L22)

Height of the spacer below rendered items (px).

##### containerRef()

> **containerRef**: (`el`) => `void`

Defined in: [chat/react/useVirtualMessages.ts:28](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useVirtualMessages.ts#L28)

Ref callback to measure container on mount.

###### Parameters

###### el

`HTMLElement` | `null`

###### Returns

`void`

##### endIndex

> **endIndex**: `number`

Defined in: [chat/react/useVirtualMessages.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useVirtualMessages.ts#L18)

End index (exclusive) in the original array.

##### onScroll()

> **onScroll**: (`event`) => `void`

Defined in: [chat/react/useVirtualMessages.ts:26](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useVirtualMessages.ts#L26)

Scroll event handler to attach to the container.

###### Parameters

###### event

###### currentTarget

\{ `clientHeight`: `number`; `scrollTop`: `number`; \}

###### currentTarget.clientHeight

`number`

###### currentTarget.scrollTop

`number`

###### Returns

`void`

##### startIndex

> **startIndex**: `number`

Defined in: [chat/react/useVirtualMessages.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useVirtualMessages.ts#L16)

Start index in the original array.

##### topSpacerHeight

> **topSpacerHeight**: `number`

Defined in: [chat/react/useVirtualMessages.ts:20](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useVirtualMessages.ts#L20)

Height of the spacer above rendered items (px).

##### totalHeight

> **totalHeight**: `number`

Defined in: [chat/react/useVirtualMessages.ts:24](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useVirtualMessages.ts#L24)

Total estimated height of all items (px).

##### visibleItems

> **visibleItems**: `T`[]

Defined in: [chat/react/useVirtualMessages.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useVirtualMessages.ts#L14)

Slice of items to actually render.

## Type Aliases

### AuthFormComponent()

> **AuthFormComponent** = (`props`) => `ReactNode`

Defined in: [chat/react/auth/types.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/types.ts#L16)

A backend auth form component.

#### Parameters

##### props

[`AuthFormProps`](#authformprops)

#### Returns

`ReactNode`

***

### RemoteAuthBackend

> **RemoteAuthBackend** = `"copilot"` \| `"claude"` \| `"vercel-ai"`

Defined in: [chat/react/useRemoteAuth.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L18)

Supported remote auth backends.

***

### RemoteAuthStatus

> **RemoteAuthStatus** = `"idle"` \| `"pending"` \| `"authenticated"` \| `"error"`

Defined in: [chat/react/useRemoteAuth.ts:21](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L21)

Auth status state machine: idle → pending → authenticated | error.

***

### RemoteChatPhase

> **RemoteChatPhase** = `"initializing"` \| `"unauthenticated"` \| `"authenticating"` \| `"creating"` \| `"ready"` \| `"error"`

Defined in: [chat/react/useRemoteChat.ts:18](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteChat.ts#L18)

Lifecycle phase for the useRemoteChat hook.

***

### SSEStatus

> **SSEStatus** = `"idle"` \| `"connecting"` \| `"open"` \| `"closed"` \| `"error"`

Defined in: [chat/react/useSSE.ts:5](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSSE.ts#L5)

Connection status of the SSE hook.

## Functions

### BackendSelector()

> **BackendSelector**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/BackendSelector.ts:23](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/BackendSelector.ts#L23)

Headless backend selector showing registered backends with active indicator.
Uses data attributes for styling:
- `[data-backend-selector]` on root
- `[data-backend-item]` on each item
- `[data-backend-active="true"]` on the active backend
- `[data-backend-name]` with backend name value

#### Parameters

##### \_\_namedParameters

[`BackendSelectorProps`](#backendselectorprops)

#### Returns

`ReactNode`

***

### ChatHeader()

> **ChatHeader**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/ChatHeader.ts:42](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatHeader.ts#L42)

Header area with backend and model selectors.
Returns null when no selectors need to be shown.

#### Parameters

##### \_\_namedParameters

[`ChatHeaderProps`](#chatheaderprops)

#### Returns

`ReactNode`

***

### ChatInputArea()

> **ChatInputArea**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/ChatInputArea.ts:50](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatInputArea.ts#L50)

Input area — unified selector + composer in a `[data-chat-input-area]` container.

#### Parameters

##### \_\_namedParameters

[`ChatInputAreaProps`](#chatinputareaprops)

#### Returns

`ReactNode`

***

### ChatLayout()

> **ChatLayout**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/ChatLayout.ts:30](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatLayout.ts#L30)

Pure layout container — flex row with optional sidebar and overlay.

Renders `[data-chat-ui]` root with:
- overlay (rendered first for z-index stacking)
- sidebar (rendered before main content)
- children (main chat area)

#### Parameters

##### \_\_namedParameters

[`ChatLayoutProps`](#chatlayoutprops)

#### Returns

`ReactNode`

***

### ChatProvider()

> **ChatProvider**(`__namedParameters`): `FunctionComponentElement`\<`ProviderProps`\<[`IChatClient`](../../../chat/runtime.md#ichatclient)\<`Record`\<`string`, `unknown`\>\> \| `null`\>\>

Defined in: [chat/react/ChatProvider.ts:17](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatProvider.ts#L17)

React context provider wrapping IChatClient.
All chat hooks must be used within a ChatProvider.

#### Parameters

##### \_\_namedParameters

`ChatProviderProps`

#### Returns

`FunctionComponentElement`\<`ProviderProps`\<[`IChatClient`](../../../chat/runtime.md#ichatclient)\<`Record`\<`string`, `unknown`\>\> \| `null`\>\>

***

### ChatSettingsOverlay()

> **ChatSettingsOverlay**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/ChatSettingsOverlay.ts:43](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatSettingsOverlay.ts#L43)

Settings modal — renders `[data-provider-settings-overlay]` when open.
Returns null when closed.
Backdrop click and Escape key close the overlay with exit animation.
Focus is trapped within the overlay content.

#### Parameters

##### \_\_namedParameters

[`ChatSettingsOverlayProps`](#chatsettingsoverlayprops)

#### Returns

`ReactNode`

***

### ChatUI()

> **ChatUI**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/ChatUI.ts:302](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatUI.ts#L302)

Composite chat component — complete AI chat interface in one import.

```tsx
import { ChatUI } from "@witqq/agent-sdk/chat/react";

function App() {
  return <ChatUI runtime={myRuntime} />;
}
```

#### Parameters

##### \_\_namedParameters

[`ChatUIProps`](#chatuiprops)

#### Returns

`ReactNode`

***

### ClaudeAuthForm()

> **ClaudeAuthForm**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/auth/ClaudeAuthForm.ts:12](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/ClaudeAuthForm.ts#L12)

Claude auth form — OAuth Authorization Code + PKCE.

Shows "Authenticate with Claude" button → authorize URL link +
paste-code input + "Submit" button.

Co-located with the Claude backend.

#### Parameters

##### \_\_namedParameters

[`AuthFormProps`](#authformprops)

#### Returns

`ReactNode`

***

### Composer()

> **Composer**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/Composer.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Composer.ts#L25)

Headless composer component for sending messages.
Includes auto-resizing textarea, send/stop buttons, and keyboard shortcuts.

#### Parameters

##### \_\_namedParameters

[`ComposerProps`](#composerprops)

#### Returns

`ReactNode`

***

### ContextStatsDisplay()

> **ContextStatsDisplay**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/ContextStatsDisplay.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ContextStatsDisplay.ts#L27)

Headless component displaying context window statistics.

When real usage data is available (realPromptTokens + modelContextWindow),
displays actual token usage and model context window size.
When real data is not yet available (before first API response), returns null.

All elements use `data-*` attributes for CSS styling — no inline styles.

#### Parameters

##### \_\_namedParameters

[`ContextStatsDisplayProps`](#contextstatsdisplayprops)

#### Returns

`ReactNode`

***

### CopilotAuthForm()

> **CopilotAuthForm**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/auth/CopilotAuthForm.ts:12](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/CopilotAuthForm.ts#L12)

Copilot (GitHub) auth form — device flow.

Shows "Authenticate with GitHub" button → device code + verification URL →
"Waiting..." → "✓ Authenticated" + "Continue →".

Co-located with the Copilot backend.

#### Parameters

##### \_\_namedParameters

[`AuthFormProps`](#authformprops)

#### Returns

`ReactNode`

***

### MarkdownRenderer()

> **MarkdownRenderer**(`props`): `ReactNode`

Defined in: [chat/react/MarkdownRenderer.ts:213](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/MarkdownRenderer.ts#L213)

Headless markdown renderer.
Parses markdown text to semantic HTML elements via createElement.
Supports headings, paragraphs, bold, italic, inline code, code blocks,
links, blockquotes, and lists. No external dependencies.

#### Parameters

##### props

[`MarkdownRendererProps`](#markdownrendererprops)

#### Returns

`ReactNode`

***

### Message()

> **Message**(`props`): `ReactNode`

Defined in: [chat/react/Message.ts:72](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Message.ts#L72)

Headless message component rendering ChatMessage parts.
Wraps parts in a div with data-role and data-status attributes.

#### Parameters

##### props

[`MessageProps`](#messageprops)

#### Returns

`ReactNode`

***

### ModelSelector()

> **ModelSelector**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/ModelSelector.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ModelSelector.ts#L27)

Dropdown model selector with search and keyboard navigation.
Falls back to a free-text input when models list is empty.

#### Parameters

##### \_\_namedParameters

[`ModelSelectorProps`](#modelselectorprops)

#### Returns

`ReactNode`

***

### PermissionDialog()

> **PermissionDialog**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/PermissionDialog.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/PermissionDialog.ts#L29)

Headless permission dialog component for tool approval flows.

Renders a list of pending tool calls with approve/deny buttons.
Uses `data-*` attributes for styling — no built-in styles.

Returns `null` when there are no pending requests.

#### Parameters

##### \_\_namedParameters

[`PermissionDialogProps`](#permissiondialogprops)

#### Returns

`ReactNode`

***

### ProviderModelSelector()

> **ProviderModelSelector**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/ProviderModelSelector.ts:47](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderModelSelector.ts#L47)

Unified selector that shows providers when available, falls back to model list.
Replaces the need for separate ProviderSelector + ModelSelector in ChatUI.

#### Parameters

##### \_\_namedParameters

[`ProviderModelSelectorProps`](#providermodelselectorprops)

#### Returns

`ReactNode`

***

### ProviderSelector()

> **ProviderSelector**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/ProviderSelector.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderSelector.ts#L25)

Headless dropdown for selecting a configured provider.
Uses data attributes for styling hooks. Follows ModelSelector pattern.

#### Parameters

##### \_\_namedParameters

[`ProviderSelectorProps`](#providerselectorprops)

#### Returns

`ReactNode`

***

### ProviderSettings()

> **ProviderSettings**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/ProviderSettings.ts:50](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ProviderSettings.ts#L50)

Headless settings panel for managing providers.
States: list (all providers), add (new provider flow), edit (existing).

#### Parameters

##### \_\_namedParameters

[`ProviderSettingsProps`](#providersettingsprops)

#### Returns

`ReactNode`

***

### ThinkingBlock()

> **ThinkingBlock**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/ThinkingBlock.ts:14](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThinkingBlock.ts#L14)

Headless thinking/reasoning block using native details/summary elements.
Displays "Thinking..." while streaming, "Reasoning" when complete.

#### Parameters

##### \_\_namedParameters

[`ThinkingBlockProps`](#thinkingblockprops)

#### Returns

`ReactNode`

***

### Thread()

> **Thread**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/Thread.ts:33](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/Thread.ts#L33)

Headless thread component wrapping a scrollable message list.
Auto-scrolls to bottom when new messages arrive unless user has scrolled up.
Shows a scroll-to-bottom button when scrolled up and an empty state when no messages.

#### Parameters

##### \_\_namedParameters

[`ThreadProps`](#threadprops)

#### Returns

`ReactNode`

***

### ThreadList()

> **ThreadList**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/ThreadList.ts:59](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadList.ts#L59)

Session sidebar component for listing, searching, creating, and deleting sessions.

#### Parameters

##### \_\_namedParameters

[`ThreadListProps`](#threadlistprops)

#### Returns

`ReactNode`

***

### ThreadProvider()

> **ThreadProvider**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/ThreadSlots.ts:28](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadSlots.ts#L28)

Provides slot-based customization for Thread message rendering.
Wrap a Thread in ThreadProvider to override how messages, tool calls,
or thinking blocks are rendered.

#### Parameters

##### \_\_namedParameters

[`ThreadProviderProps`](#threadproviderprops)

#### Returns

`ReactNode`

***

### ToolCallView()

> **ToolCallView**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/ToolCallView.ts:17](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ToolCallView.ts#L17)

Headless tool call display component.
Shows tool name, status, collapsible args/result, and approval buttons when needed.

#### Parameters

##### \_\_namedParameters

[`ToolCallViewProps`](#toolcallviewprops)

#### Returns

`ReactNode`

***

### UsageBadge()

> **UsageBadge**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/UsageBadge.ts:11](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/UsageBadge.ts#L11)

Compact token usage display. Shows prompt/completion/total tokens.

#### Parameters

##### \_\_namedParameters

[`UsageBadgeProps`](#usagebadgeprops)

#### Returns

`ReactNode`

***

### useApiKeyAuth()

> **useApiKeyAuth**(`options`): [`UseApiKeyAuthReturn`](#useapikeyauthreturn)

Defined in: [chat/react/auth/useApiKeyAuth.ts:39](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useApiKeyAuth.ts#L39)

API key authentication.
Sends key to server for validation and storage.

#### Parameters

##### options

[`UseApiKeyAuthOptions`](#useapikeyauthoptions)

#### Returns

[`UseApiKeyAuthReturn`](#useapikeyauthreturn)

***

### useBackends()

> **useBackends**(): [`UseBackendsReturn`](#usebackendsreturn)

Defined in: [chat/react/useBackends.ts:16](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useBackends.ts#L16)

Hook for discovering registered backends and switching between them.

#### Returns

[`UseBackendsReturn`](#usebackendsreturn)

***

### useChat()

> **useChat**(`options?`): [`UseChatReturn`](#usechatreturn)

Defined in: [chat/react/useChat.ts:56](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useChat.ts#L56)

Convenience hook for chat interaction.
Wraps IChatRuntime with React state management and progressive streaming.
Messages update in real-time as tokens arrive (not after full response).

#### Parameters

##### options?

[`UseChatOptions`](#usechatoptions) = `{}`

#### Returns

[`UseChatReturn`](#usechatreturn)

***

### useChatRuntime()

> **useChatRuntime**(): [`IChatClient`](../../../chat/runtime.md#ichatclient)

Defined in: [chat/react/ChatProvider.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ChatProvider.ts#L27)

Access the IChatClient from context.
Must be used within a ChatProvider.

#### Returns

[`IChatClient`](../../../chat/runtime.md#ichatclient)

#### Throws

If used outside ChatProvider

***

### useClaudeAuth()

> **useClaudeAuth**(`options`): [`UseClaudeAuthReturn`](#useclaudeauthreturn)

Defined in: [chat/react/auth/useClaudeAuth.ts:42](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useClaudeAuth.ts#L42)

Claude OAuth + PKCE authentication.
Two-step flow: start() gets authorizeUrl → user redirects → complete(code) finishes.

#### Parameters

##### options

[`UseClaudeAuthOptions`](#useclaudeauthoptions)

#### Returns

[`UseClaudeAuthReturn`](#useclaudeauthreturn)

***

### useCopilotAuth()

> **useCopilotAuth**(`options`): [`UseCopilotAuthReturn`](#usecopilotauthreturn)

Defined in: [chat/react/auth/useCopilotAuth.ts:41](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/useCopilotAuth.ts#L41)

Copilot Device Flow authentication.
Starts device flow on server, provides code/URL for user, polls until complete.

#### Parameters

##### options

[`UseCopilotAuthOptions`](#usecopilotauthoptions)

#### Returns

[`UseCopilotAuthReturn`](#usecopilotauthreturn)

***

### useMessages()

> **useMessages**(`options`): [`UseMessagesReturn`](#usemessagesreturn)

Defined in: [chat/react/useMessages.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useMessages.ts#L29)

Reactive message list via useSyncExternalStore.

If the session supports subscribe/getSnapshot (reactive session),
uses useSyncExternalStore for granular updates.
Otherwise, falls back to polling via getSession().

#### Parameters

##### options

[`UseMessagesOptions`](#usemessagesoptions)

#### Returns

[`UseMessagesReturn`](#usemessagesreturn)

***

### useModels()

> **useModels**(): [`UseModelsReturn`](#usemodelsreturn)

Defined in: [chat/react/useModels.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useModels.ts#L25)

Hook for fetching and searching available models from the chat runtime.

#### Returns

[`UseModelsReturn`](#usemodelsreturn)

***

### useOptionalThreadSlots()

> **useOptionalThreadSlots**(): [`ThreadSlotOverrides`](#threadslotoverrides) \| `null`

Defined in: [chat/react/ThreadSlots.ts:54](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadSlots.ts#L54)

Access slot overrides if inside a ThreadProvider, or null if not.
Safe to call without a ThreadProvider ancestor.

#### Returns

[`ThreadSlotOverrides`](#threadslotoverrides) \| `null`

***

### useProviders()

> **useProviders**(): [`UseProvidersReturn`](#useprovidersreturn)

Defined in: [chat/react/useProviders.ts:39](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useProviders.ts#L39)

Hook for managing providers (backend + model combos).
Requires an IChatClient with provider methods (e.g. RemoteChatClient).

#### Returns

[`UseProvidersReturn`](#useprovidersreturn)

***

### useRemoteAuth()

> **useRemoteAuth**(`options`): [`UseRemoteAuthReturn`](#useremoteauthreturn)

Defined in: [chat/react/useRemoteAuth.ts:82](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteAuth.ts#L82)

Server-delegated authentication hook.

Communicates with server auth handler endpoints (POST /auth/start,
POST /auth/copilot/poll, etc.) instead of running auth flows in the browser.
No node:crypto dependency since all crypto operations happen server-side.

#### Parameters

##### options

[`UseRemoteAuthOptions`](#useremoteauthoptions)

Hook configuration

#### Returns

[`UseRemoteAuthReturn`](#useremoteauthreturn)

Auth state and action methods

#### Example

```ts
const auth = useRemoteAuth({
  backend: "copilot",
  baseUrl: "/api/auth",
  onAuthenticated: (token) => console.log("Authenticated:", token),
});
```

***

### useRemoteChat()

> **useRemoteChat**(`options`): [`UseRemoteChatReturn`](#useremotechatreturn)

Defined in: [chat/react/useRemoteChat.ts:79](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useRemoteChat.ts#L79)

Lifecycle hook: auth → runtime → session.

#### Parameters

##### options

[`UseRemoteChatOptions`](#useremotechatoptions)

#### Returns

[`UseRemoteChatReturn`](#useremotechatreturn)

#### Example

```tsx
const chat = useRemoteChat({
  chatBaseUrl: "/api/chat",
  authBaseUrl: "/api/auth",
  backend: "copilot",
});

if (chat.phase === "unauthenticated") {
  return <button onClick={() => chat.auth.start()}>Login</button>;
}
if (chat.phase === "ready" && chat.runtime) {
  return <ChatProvider runtime={chat.runtime}>...</ChatProvider>;
}
```

***

### useSessions()

> **useSessions**(): [`UseSessionsReturn`](#usesessionsreturn)

Defined in: [chat/react/useSessions.ts:43](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSessions.ts#L43)

Reactive session list hook.
Subscribes to `runtime.onSessionChange()` and refreshes the list automatically
on create, delete, and message send completion.

#### Returns

[`UseSessionsReturn`](#usesessionsreturn)

***

### useSSE()

> **useSSE**(`url`, `options?`): [`UseSSEReturn`](#usessereturn)

Defined in: [chat/react/useSSE.ts:32](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useSSE.ts#L32)

SSE transport hook using fetch (not EventSource).
Parses text/event-stream format with support for multi-line data and event types.

#### Parameters

##### url

`string` | `null`

##### options?

[`UseSSEOptions`](#usesseoptions) = `{}`

#### Returns

[`UseSSEReturn`](#usessereturn)

***

### useThreadSlots()

> **useThreadSlots**(): [`ThreadSlotOverrides`](#threadslotoverrides)

Defined in: [chat/react/ThreadSlots.ts:42](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/ThreadSlots.ts#L42)

Access slot overrides from ThreadProvider context.

#### Returns

[`ThreadSlotOverrides`](#threadslotoverrides)

#### Throws

If used outside a ThreadProvider

***

### useToolApproval()

> **useToolApproval**(`messages`, `onApprove?`, `onDeny?`): [`UseToolApprovalReturn`](#usetoolapprovalreturn)

Defined in: [chat/react/useToolApproval.ts:30](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useToolApproval.ts#L30)

Hook that tracks tool calls requiring approval from messages.

Scans messages for ToolCallParts with status "requires_approval"
and provides approve/deny callbacks. Currently state-only
(no ChatEventBus integration).

#### Parameters

##### messages

[`ChatMessage`](../../../chat.md#chatmessage)\<`unknown`\>[]

Messages to scan for pending tool approvals

##### onApprove?

(`toolCallId`) => `void`

Called when a tool call is approved

##### onDeny?

(`toolCallId`) => `void`

Called when a tool call is denied

#### Returns

[`UseToolApprovalReturn`](#usetoolapprovalreturn)

***

### useVirtualMessages()

> **useVirtualMessages**\<`T`\>(`items`, `options?`): [`VirtualMessagesResult`](#virtualmessagesresult)\<`T`\>

Defined in: [chat/react/useVirtualMessages.ts:40](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/useVirtualMessages.ts#L40)

Hook providing windowed rendering for a list of items.

Only items within the visible viewport (plus overscan) are returned.
Consumers render top/bottom spacer divs to preserve scroll position.

#### Type Parameters

##### T

`T`

#### Parameters

##### items

readonly `T`[]

Full array of items

##### options?

[`VirtualizeOptions`](#virtualizeoptions) = `{}`

Virtualization config

#### Returns

[`VirtualMessagesResult`](#virtualmessagesresult)\<`T`\>

***

### VercelAIAuthForm()

> **VercelAIAuthForm**(`__namedParameters`): `ReactNode`

Defined in: [chat/react/auth/VercelAIAuthForm.ts:11](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/react/auth/VercelAIAuthForm.ts#L11)

Vercel AI auth form — API key + optional base URL.

Shows base URL input + API key input + "Connect" button.

Co-located with the Vercel AI backend.

#### Parameters

##### \_\_namedParameters

[`AuthFormProps`](#authformprops)

#### Returns

`ReactNode`

[**@witqq/agent-sdk**](../README.md)

***

[@witqq/agent-sdk](../README.md) / chat/server

# chat/server

## Classes

### AdapterPool

Defined in: [chat/server/adapter-pool.ts:48](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/adapter-pool.ts#L48)

Lazy adapter pool with concurrent dedup and eviction.
Thread-safe: concurrent getAdapter() calls for the same backend share a single creation promise.

#### Type Parameters

##### T

`T` *extends* [`PooledAdapter`](#pooledadapter) = [`PooledAdapter`](#pooledadapter)

#### Constructors

##### Constructor

> **new AdapterPool**\<`T`\>(`options`): [`AdapterPool`](#adapterpool)\<`T`\>

Defined in: [chat/server/adapter-pool.ts:54](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/adapter-pool.ts#L54)

###### Parameters

###### options

[`AdapterPoolOptions`](#adapterpooloptions)\<`T`\>

###### Returns

[`AdapterPool`](#adapterpool)\<`T`\>

#### Accessors

##### activeBackends

###### Get Signature

> **get** **activeBackends**(): `string`[]

Defined in: [chat/server/adapter-pool.ts:108](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/adapter-pool.ts#L108)

Get all backend names with cached adapters.

###### Returns

`string`[]

#### Methods

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [chat/server/adapter-pool.ts:113](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/adapter-pool.ts#L113)

Dispose all cached adapters and mark pool as unusable.

###### Returns

`Promise`\<`void`\>

##### evict()

> **evict**(`backend`): `Promise`\<`void`\>

Defined in: [chat/server/adapter-pool.ts:94](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/adapter-pool.ts#L94)

Evict (dispose and remove) the cached adapter for a backend.
Use after token rotation to force re-creation on next getAdapter().

###### Parameters

###### backend

`string`

###### Returns

`Promise`\<`void`\>

##### getAdapter()

> **getAdapter**(`backend`): `Promise`\<`T`\>

Defined in: [chat/server/adapter-pool.ts:63](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/adapter-pool.ts#L63)

Get or create an adapter for the given backend.
Concurrent calls for the same backend share one creation promise.
Failed creations are NOT cached — next call retries.

###### Parameters

###### backend

`string`

###### Returns

`Promise`\<`T`\>

##### has()

> **has**(`backend`): `boolean`

Defined in: [chat/server/adapter-pool.ts:103](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/adapter-pool.ts#L103)

Check if a backend has a cached adapter.

###### Parameters

###### backend

`string`

###### Returns

`boolean`

***

### BodyParseError

Defined in: [chat/server/utils.ts:8](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/utils.ts#L8)

Error thrown by readBody with an HTTP status code

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new BodyParseError**(`message`, `statusCode`): [`BodyParseError`](#bodyparseerror)

Defined in: [chat/server/utils.ts:10](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/utils.ts#L10)

###### Parameters

###### message

`string`

###### statusCode

`number`

###### Returns

[`BodyParseError`](#bodyparseerror)

###### Overrides

`Error.constructor`

#### Properties

##### statusCode

> `readonly` **statusCode**: `number`

Defined in: [chat/server/utils.ts:9](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/utils.ts#L9)

***

### FileProviderStore

Defined in: [chat/server/provider-store.ts:58](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-store.ts#L58)

Filesystem-based provider store using JSON files (one per provider)

#### Implements

- [`IProviderStore`](../chat.md#iproviderstore)

#### Constructors

##### Constructor

> **new FileProviderStore**(`options`): [`FileProviderStore`](#fileproviderstore)

Defined in: [chat/server/provider-store.ts:61](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-store.ts#L61)

###### Parameters

###### options

[`FileProviderStoreOptions`](#fileproviderstoreoptions)

###### Returns

[`FileProviderStore`](#fileproviderstore)

#### Methods

##### create()

> **create**(`config`): `Promise`\<`void`\>

Defined in: [chat/server/provider-store.ts:65](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-store.ts#L65)

Create a new provider. Generates UUID if id not set on config.

###### Parameters

###### config

[`ProviderConfig`](../chat.md#providerconfig)

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IProviderStore`](../chat.md#iproviderstore).[`create`](../chat.md#create)

##### delete()

> **delete**(`id`): `Promise`\<`void`\>

Defined in: [chat/server/provider-store.ts:90](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-store.ts#L90)

Delete a provider by id.

###### Parameters

###### id

`string`

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IProviderStore`](../chat.md#iproviderstore).[`delete`](../chat.md#delete)

##### get()

> **get**(`id`): `Promise`\<[`ProviderConfig`](../chat.md#providerconfig) \| `null`\>

Defined in: [chat/server/provider-store.ts:72](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-store.ts#L72)

Get a provider by id. Returns null if not found.

###### Parameters

###### id

`string`

###### Returns

`Promise`\<[`ProviderConfig`](../chat.md#providerconfig) \| `null`\>

###### Implementation of

[`IProviderStore`](../chat.md#iproviderstore).[`get`](../chat.md#get)

##### list()

> **list**(): `Promise`\<[`ProviderConfig`](../chat.md#providerconfig)[]\>

Defined in: [chat/server/provider-store.ts:98](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-store.ts#L98)

List all providers.

###### Returns

`Promise`\<[`ProviderConfig`](../chat.md#providerconfig)[]\>

###### Implementation of

[`IProviderStore`](../chat.md#iproviderstore).[`list`](../chat.md#list)

##### update()

> **update**(`id`, `changes`): `Promise`\<`void`\>

Defined in: [chat/server/provider-store.ts:81](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-store.ts#L81)

Update an existing provider. Throws if not found.

###### Parameters

###### id

`string`

###### changes

`Partial`\<`Omit`\<[`ProviderConfig`](../chat.md#providerconfig), `"id"` \| `"createdAt"`\>\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IProviderStore`](../chat.md#iproviderstore).[`update`](../chat.md#update)

***

### FileTokenStore

Defined in: [chat/server/token-store.ts:64](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L64)

Filesystem-based token store using JSON files (one per provider)

#### Implements

- [`ITokenStore`](#itokenstore)

#### Constructors

##### Constructor

> **new FileTokenStore**(`options`): [`FileTokenStore`](#filetokenstore)

Defined in: [chat/server/token-store.ts:67](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L67)

###### Parameters

###### options

[`FileTokenStoreOptions`](#filetokenstoreoptions)

###### Returns

[`FileTokenStore`](#filetokenstore)

#### Methods

##### clear()

> **clear**(`provider`): `Promise`\<`void`\>

Defined in: [chat/server/token-store.ts:85](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L85)

Remove a specific provider's token.

###### Parameters

###### provider

`string`

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`ITokenStore`](#itokenstore).[`clear`](#clear-2)

##### clearAll()

> **clearAll**(): `Promise`\<`void`\>

Defined in: [chat/server/token-store.ts:93](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L93)

Remove all stored tokens.

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`ITokenStore`](#itokenstore).[`clearAll`](#clearall-2)

##### list()

> **list**(): `Promise`\<`string`[]\>

Defined in: [chat/server/token-store.ts:106](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L106)

List provider names that have saved tokens.

###### Returns

`Promise`\<`string`[]\>

###### Implementation of

[`ITokenStore`](#itokenstore).[`list`](#list-4)

##### load()

> **load**(`provider`): `Promise`\<[`AuthToken`](../auth.md#authtoken) \| `null`\>

Defined in: [chat/server/token-store.ts:76](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L76)

Load a previously saved token. Returns null if not found.

###### Parameters

###### provider

`string`

###### Returns

`Promise`\<[`AuthToken`](../auth.md#authtoken) \| `null`\>

###### Implementation of

[`ITokenStore`](#itokenstore).[`load`](#load-2)

##### save()

> **save**(`provider`, `token`): `Promise`\<`void`\>

Defined in: [chat/server/token-store.ts:71](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L71)

Save a token for a provider. Overwrites if exists.

###### Parameters

###### provider

`string`

###### token

[`AuthToken`](../auth.md#authtoken)

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`ITokenStore`](#itokenstore).[`save`](#save-2)

***

### InMemoryProviderStore

Defined in: [chat/server/provider-store.ts:19](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-store.ts#L19)

In-memory provider store for testing and ephemeral use

#### Implements

- [`IProviderStore`](../chat.md#iproviderstore)

#### Constructors

##### Constructor

> **new InMemoryProviderStore**(): [`InMemoryProviderStore`](#inmemoryproviderstore)

###### Returns

[`InMemoryProviderStore`](#inmemoryproviderstore)

#### Methods

##### create()

> **create**(`config`): `Promise`\<`void`\>

Defined in: [chat/server/provider-store.ts:22](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-store.ts#L22)

Create a new provider. Generates UUID if id not set on config.

###### Parameters

###### config

[`ProviderConfig`](../chat.md#providerconfig)

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IProviderStore`](../chat.md#iproviderstore).[`create`](../chat.md#create)

##### delete()

> **delete**(`id`): `Promise`\<`void`\>

Defined in: [chat/server/provider-store.ts:40](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-store.ts#L40)

Delete a provider by id.

###### Parameters

###### id

`string`

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IProviderStore`](../chat.md#iproviderstore).[`delete`](../chat.md#delete)

##### get()

> **get**(`id`): `Promise`\<[`ProviderConfig`](../chat.md#providerconfig) \| `null`\>

Defined in: [chat/server/provider-store.ts:27](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-store.ts#L27)

Get a provider by id. Returns null if not found.

###### Parameters

###### id

`string`

###### Returns

`Promise`\<[`ProviderConfig`](../chat.md#providerconfig) \| `null`\>

###### Implementation of

[`IProviderStore`](../chat.md#iproviderstore).[`get`](../chat.md#get)

##### list()

> **list**(): `Promise`\<[`ProviderConfig`](../chat.md#providerconfig)[]\>

Defined in: [chat/server/provider-store.ts:44](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-store.ts#L44)

List all providers.

###### Returns

`Promise`\<[`ProviderConfig`](../chat.md#providerconfig)[]\>

###### Implementation of

[`IProviderStore`](../chat.md#iproviderstore).[`list`](../chat.md#list)

##### update()

> **update**(`id`, `changes`): `Promise`\<`void`\>

Defined in: [chat/server/provider-store.ts:32](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-store.ts#L32)

Update an existing provider. Throws if not found.

###### Parameters

###### id

`string`

###### changes

`Partial`\<`Omit`\<[`ProviderConfig`](../chat.md#providerconfig), `"id"` \| `"createdAt"`\>\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IProviderStore`](../chat.md#iproviderstore).[`update`](../chat.md#update)

***

### InMemoryTokenStore

Defined in: [chat/server/token-store.ts:30](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L30)

In-memory token store for testing and ephemeral use

#### Implements

- [`ITokenStore`](#itokenstore)

#### Constructors

##### Constructor

> **new InMemoryTokenStore**(): [`InMemoryTokenStore`](#inmemorytokenstore)

###### Returns

[`InMemoryTokenStore`](#inmemorytokenstore)

#### Methods

##### clear()

> **clear**(`provider`): `Promise`\<`void`\>

Defined in: [chat/server/token-store.ts:42](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L42)

Remove a specific provider's token.

###### Parameters

###### provider

`string`

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`ITokenStore`](#itokenstore).[`clear`](#clear-2)

##### clearAll()

> **clearAll**(): `Promise`\<`void`\>

Defined in: [chat/server/token-store.ts:46](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L46)

Remove all stored tokens.

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`ITokenStore`](#itokenstore).[`clearAll`](#clearall-2)

##### list()

> **list**(): `Promise`\<`string`[]\>

Defined in: [chat/server/token-store.ts:50](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L50)

List provider names that have saved tokens.

###### Returns

`Promise`\<`string`[]\>

###### Implementation of

[`ITokenStore`](#itokenstore).[`list`](#list-4)

##### load()

> **load**(`provider`): `Promise`\<[`AuthToken`](../auth.md#authtoken) \| `null`\>

Defined in: [chat/server/token-store.ts:37](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L37)

Load a previously saved token. Returns null if not found.

###### Parameters

###### provider

`string`

###### Returns

`Promise`\<[`AuthToken`](../auth.md#authtoken) \| `null`\>

###### Implementation of

[`ITokenStore`](#itokenstore).[`load`](#load-2)

##### save()

> **save**(`provider`, `token`): `Promise`\<`void`\>

Defined in: [chat/server/token-store.ts:33](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L33)

Save a token for a provider. Overwrites if exists.

###### Parameters

###### provider

`string`

###### token

[`AuthToken`](../auth.md#authtoken)

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`ITokenStore`](#itokenstore).[`save`](#save-2)

***

### ServiceManager

Defined in: [chat/server/service-manager.ts:59](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/service-manager.ts#L59)

Manages IAgentService lifecycle: create, cache, and dispose on re-auth or logout.
Optionally starts background token refresh when `refreshFactory` is configured.

#### Constructors

##### Constructor

> **new ServiceManager**(`options`): [`ServiceManager`](#servicemanager-1)

Defined in: [chat/server/service-manager.ts:64](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/service-manager.ts#L64)

###### Parameters

###### options

[`ServiceManagerOptions`](#servicemanageroptions)

###### Returns

[`ServiceManager`](#servicemanager-1)

#### Accessors

##### activeBackends

###### Get Signature

> **get** **activeBackends**(): `string`[]

Defined in: [chat/server/service-manager.ts:126](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/service-manager.ts#L126)

Get all backend names with active services.

###### Returns

`string`[]

#### Methods

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [chat/server/service-manager.ts:111](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/service-manager.ts#L111)

Dispose the ServiceManager — stops all refresh managers and disposes all services.

###### Returns

`Promise`\<`void`\>

##### getRefreshManager()

> **getRefreshManager**(`backend`): [`TokenRefreshManager`](../auth.md#tokenrefreshmanager) \| `undefined`

Defined in: [chat/server/service-manager.ts:131](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/service-manager.ts#L131)

Get active refresh manager for a backend (for testing/introspection).

###### Parameters

###### backend

`string`

###### Returns

[`TokenRefreshManager`](../auth.md#tokenrefreshmanager) \| `undefined`

##### getService()

> **getService**(`backend`): [`ManagedService`](#managedservice) \| `undefined`

Defined in: [chat/server/service-manager.ts:116](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/service-manager.ts#L116)

Get cached service for a backend (undefined if not authenticated).

###### Parameters

###### backend

`string`

###### Returns

[`ManagedService`](#managedservice) \| `undefined`

##### handleAuth()

> **handleAuth**(`backend`, `token`): `Promise`\<[`ManagedService`](#managedservice)\>

Defined in: [chat/server/service-manager.ts:73](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/service-manager.ts#L73)

Handle auth event: dispose old service (if any) and create new one.
If the token is refreshable and refreshFactory is configured, starts a
TokenRefreshManager that auto-refreshes and recreates the service.

###### Parameters

###### backend

`string`

###### token

[`AuthToken`](../auth.md#authtoken)

###### Returns

`Promise`\<[`ManagedService`](#managedservice)\>

##### handleLogout()

> **handleLogout**(): `Promise`\<`void`\>

Defined in: [chat/server/service-manager.ts:96](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/service-manager.ts#L96)

Handle logout: dispose all services, stop all refresh managers, clear cache.

###### Returns

`Promise`\<`void`\>

##### hasService()

> **hasService**(`backend`): `boolean`

Defined in: [chat/server/service-manager.ts:121](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/service-manager.ts#L121)

Check if a service exists for the given backend.

###### Parameters

###### backend

`string`

###### Returns

`boolean`

## Interfaces

### AdapterPoolOptions

Defined in: [chat/server/adapter-pool.ts:39](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/adapter-pool.ts#L39)

Configuration for AdapterPool

#### Type Parameters

##### T

`T` *extends* [`PooledAdapter`](#pooledadapter) = [`PooledAdapter`](#pooledadapter)

#### Properties

##### factory

> **factory**: [`AdapterFactory`](#adapterfactory)\<`T`\>

Defined in: [chat/server/adapter-pool.ts:41](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/adapter-pool.ts#L41)

Factory to create an adapter for a backend. Called lazily on first getAdapter().

***

### AuthHandlerOptions

Defined in: [chat/server/auth-handler.ts:55](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/auth-handler.ts#L55)

Configuration for createAuthHandler

#### Properties

##### createClaudeAuth()?

> `optional` **createClaudeAuth**: () => [`IClaudeAuth`](#iclaudeauth)

Defined in: [chat/server/auth-handler.ts:61](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/auth-handler.ts#L61)

Factory for creating ClaudeAuth instances

###### Returns

[`IClaudeAuth`](#iclaudeauth)

##### createCopilotAuth()?

> `optional` **createCopilotAuth**: () => [`ICopilotAuth`](#icopilotauth)

Defined in: [chat/server/auth-handler.ts:59](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/auth-handler.ts#L59)

Factory for creating CopilotAuth instances

###### Returns

[`ICopilotAuth`](#icopilotauth)

##### maxBodySize?

> `optional` **maxBodySize**: `number`

Defined in: [chat/server/auth-handler.ts:69](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/auth-handler.ts#L69)

Maximum request body size in bytes. Default: 1MB

##### onAuth?

> `optional` **onAuth**: [`OnAuthCallback`](#onauthcallback)

Defined in: [chat/server/auth-handler.ts:63](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/auth-handler.ts#L63)

Called after successful authentication for any provider

##### onLogout()?

> `optional` **onLogout**: () => `void` \| `Promise`\<`void`\>

Defined in: [chat/server/auth-handler.ts:65](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/auth-handler.ts#L65)

Called when dispose/logout is requested

###### Returns

`void` \| `Promise`\<`void`\>

##### prefix?

> `optional` **prefix**: `string`

Defined in: [chat/server/auth-handler.ts:67](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/auth-handler.ts#L67)

Route prefix to strip from URL before matching. Default: ""

##### tokenStore

> **tokenStore**: [`ITokenStore`](#itokenstore)

Defined in: [chat/server/auth-handler.ts:57](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/auth-handler.ts#L57)

Token storage implementation

***

### ChatHandlerOptions

Defined in: [chat/server/handler.ts:59](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L59)

Configuration for createChatHandler

#### Properties

##### heartbeatMs?

> `optional` **heartbeatMs**: `number`

Defined in: [chat/server/handler.ts:65](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L65)

SSE heartbeat interval in milliseconds. 0 or undefined disables heartbeat.

##### hooks?

> `optional` **hooks**: [`ChatServerHooks`](#chatserverhooks)

Defined in: [chat/server/handler.ts:71](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L71)

Consolidated server hooks.

##### maxBodySize?

> `optional` **maxBodySize**: `number`

Defined in: [chat/server/handler.ts:63](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L63)

Maximum request body size in bytes. Default: 1MB (1048576)

##### prefix?

> `optional` **prefix**: `string`

Defined in: [chat/server/handler.ts:61](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L61)

Route prefix to strip from URL before matching. Default: "" (no prefix)

##### providerStore?

> `optional` **providerStore**: [`IProviderStore`](../chat.md#iproviderstore)

Defined in: [chat/server/handler.ts:67](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L67)

Optional provider store for provider CRUD routes.

##### tokenStore?

> `optional` **tokenStore**: [`ITokenStore`](#itokenstore)

Defined in: [chat/server/handler.ts:69](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L69)

Optional token store for resolveRequestContext in /send.

##### transportFactory?

> `optional` **transportFactory**: [`TransportFactory`](#transportfactory-2)

Defined in: [chat/server/handler.ts:73](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L73)

Custom transport factory for /send endpoint. Default: SSEChatTransport.

***

### ChatServerHooks

Defined in: [chat/server/handler.ts:36](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L36)

Server-side hooks for customizing chat handler behavior.
Consolidates filter, guard, and lifecycle callbacks into a single interface.

#### Methods

##### filterModels()?

> `optional` **filterModels**(`models`): [`ModelInfo`](../index.md#modelinfo)[]

Defined in: [chat/server/handler.ts:38](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L38)

Filter the model list before returning to client.

###### Parameters

###### models

[`ModelInfo`](../index.md#modelinfo)[]

###### Returns

[`ModelInfo`](../index.md#modelinfo)[]

##### onBackendSwitch()?

> `optional` **onBackendSwitch**(`backend`): `void` \| `Promise`\<`void`\>

Defined in: [chat/server/handler.ts:44](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L44)

Called before backend switch. Throw to reject.

###### Parameters

###### backend

`string`

###### Returns

`void` \| `Promise`\<`void`\>

##### onBeforeSend()?

> `optional` **onBeforeSend**(`sessionId`, `message`): `void` \| `Promise`\<`void`\>

Defined in: [chat/server/handler.ts:46](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L46)

Called before sending a message. Throw to reject.

###### Parameters

###### sessionId

`string`

###### message

`string`

###### Returns

`void` \| `Promise`\<`void`\>

##### onError()?

> `optional` **onError**(`error`, `context`): `void`

Defined in: [chat/server/handler.ts:48](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L48)

Global error handler for unhandled route errors.

###### Parameters

###### error

`Error`

###### context

###### method

`string`

###### route

`string`

###### Returns

`void`

##### onModelSwitch()?

> `optional` **onModelSwitch**(`model`): `void` \| `Promise`\<`void`\>

Defined in: [chat/server/handler.ts:40](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L40)

Validate model selection on /model/switch and /send model override. Throw to reject.

###### Parameters

###### model

`string`

###### Returns

`void` \| `Promise`\<`void`\>

##### onProviderSwitch()?

> `optional` **onProviderSwitch**(`info`): `void` \| `Promise`\<`void`\>

Defined in: [chat/server/handler.ts:42](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L42)

Called before provider switch. Receives providerId and resolved backend name. Throw to reject.

###### Parameters

###### info

###### backend

`string`

###### providerId

`string`

###### Returns

`void` \| `Promise`\<`void`\>

***

### ChatServerOptions

Defined in: [chat/server/chat-server.ts:39](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L39)

Configuration for createChatServer

#### Properties

##### auth?

> `optional` **auth**: [`AuthHandlerOptions`](#authhandleroptions)

Defined in: [chat/server/chat-server.ts:53](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L53)

Auth handler options. If provided, auth routes are mounted.

##### authPrefix?

> `optional` **authPrefix**: `string`

Defined in: [chat/server/chat-server.ts:56](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L56)

Prefix for auth routes. Default: "/api/auth"

##### autoCreateProviders?

> `optional` **autoCreateProviders**: `boolean` \| `Record`\<`string`, `string`\>

Defined in: [chat/server/chat-server.ts:91](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L91)

Auto-create a default provider when a backend authenticates for the first time.

- `true` — uses built-in default models per backend
- `Record<string, string>` — custom backend→model mapping (e.g. `{ copilot: "gpt-5-mini" }`)
- `false` / omitted — disabled

Requires both `auth` and `providers` to be configured.

##### chatHandlerOptions?

> `optional` **chatHandlerOptions**: `Omit`\<[`ChatHandlerOptions`](#chathandleroptions), `"prefix"`\>

Defined in: [chat/server/chat-server.ts:74](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L74)

Chat handler options (maxBodySize, etc.)

##### chatPrefix?

> `optional` **chatPrefix**: `string`

Defined in: [chat/server/chat-server.ts:50](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L50)

Prefix for chat API routes. Default: "/api/chat"

##### cors?

> `optional` **cors**: `false` \| [`CorsOptions`](#corsoptions)

Defined in: [chat/server/chat-server.ts:59](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L59)

CORS options. Pass false to disable CORS. Default: enabled with permissive settings

##### healthPath?

> `optional` **healthPath**: `string` \| `false`

Defined in: [chat/server/chat-server.ts:80](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L80)

Path for the health check endpoint. Default: "/api/health".
Set to `false` to disable. Returns `{ ok: true }`.

##### hooks?

> `optional` **hooks**: [`ChatServerHooks`](#chatserverhooks)

Defined in: [chat/server/chat-server.ts:47](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L47)

Server-side hooks for customizing handler behavior.

##### providerPrefix?

> `optional` **providerPrefix**: `string`

Defined in: [chat/server/chat-server.ts:71](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L71)

Prefix for provider routes. Default: "/api/providers"

##### providers?

> `optional` **providers**: [`ProviderHandlerOptions`](#providerhandleroptions)

Defined in: [chat/server/chat-server.ts:68](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L68)

Provider handler options. If provided, provider routes are mounted.

##### runtime?

> `optional` **runtime**: [`IChatRuntime`](runtime.md#ichatruntime)\<`Record`\<`string`, `unknown`\>\>

Defined in: [chat/server/chat-server.ts:41](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L41)

Pre-built runtime instance. Either `runtime` or `runtimeConfig` must be provided.

##### runtimeConfig?

> `optional` **runtimeConfig**: [`ChatRuntimeOptions`](runtime.md#chatruntimeoptions)

Defined in: [chat/server/chat-server.ts:44](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L44)

Config to auto-create a runtime. Used when `runtime` is not provided.

##### serviceManager?

> `optional` **serviceManager**: [`ServiceManager`](#servicemanager-1)

Defined in: [chat/server/chat-server.ts:100](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L100)

Service lifecycle manager. When provided with `auth`, automatically wires:
- `onAuth` → `serviceManager.handleAuth(backend, token)` (creates/caches service)
- `onLogout` → `serviceManager.handleLogout()` (disposes all services)

User's own `onAuth`/`onLogout` callbacks in `auth` are still called first.

##### staticDir?

> `optional` **staticDir**: `string`

Defined in: [chat/server/chat-server.ts:62](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L62)

Directory to serve static files from. Omit to disable static serving.

##### staticPrefix?

> `optional` **staticPrefix**: `string`

Defined in: [chat/server/chat-server.ts:65](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L65)

Prefix for static file routes. Default: "/"

***

### CorsOptions

Defined in: [chat/server/cors.ts:8](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/cors.ts#L8)

Configuration for CORS middleware

#### Properties

##### headers?

> `optional` **headers**: `string`[]

Defined in: [chat/server/cors.ts:14](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/cors.ts#L14)

Allowed request headers. Default: ["Content-Type"]

##### maxAge?

> `optional` **maxAge**: `number`

Defined in: [chat/server/cors.ts:16](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/cors.ts#L16)

Max age for preflight cache in seconds. Default: 86400 (24h)

##### methods?

> `optional` **methods**: `string`[]

Defined in: [chat/server/cors.ts:12](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/cors.ts#L12)

Allowed HTTP methods. Default: common REST methods

##### origin?

> `optional` **origin**: `string` \| `string`[]

Defined in: [chat/server/cors.ts:10](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/cors.ts#L10)

Allowed origins. Default: "*" (any origin)

***

### FileProviderStoreOptions

Defined in: [chat/server/provider-store.ts:52](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-store.ts#L52)

Options for FileProviderStore

#### Properties

##### directory

> **directory**: `string`

Defined in: [chat/server/provider-store.ts:54](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-store.ts#L54)

Directory to store provider JSON files

***

### FileTokenStoreOptions

Defined in: [chat/server/token-store.ts:58](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L58)

Options for FileTokenStore

#### Properties

##### directory

> **directory**: `string`

Defined in: [chat/server/token-store.ts:60](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L60)

Directory to store token JSON files. Default: ".tokens" in cwd

***

### ~~HandlerState~~

Defined in: [chat/server/routes/types.ts:17](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/routes/types.ts#L17)

Handler state — intentionally empty after stateless refactor (STAT-01).
Preserved as a type for backward compatibility with custom route modules.
Model resolution is now fully per-request via resolveRequestContext.

#### Deprecated

Will be removed in next major version.

#### Properties

##### ~~currentModel?~~

> `optional` **currentModel**: `string`

Defined in: [chat/server/routes/types.ts:19](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/routes/types.ts#L19)

###### Deprecated

Model is now resolved per-request. This field is never set.

***

### IClaudeAuth

Defined in: [chat/server/auth-handler.ts:38](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/auth-handler.ts#L38)

Claude auth class interface (matches ClaudeAuth public API)

#### Methods

##### startOAuthFlow()

> **startOAuthFlow**(`options?`): `object`

Defined in: [chat/server/auth-handler.ts:39](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/auth-handler.ts#L39)

###### Parameters

###### options?

###### redirectUri?

`string`

###### scopes?

`string`

###### Returns

`object`

###### authorizeUrl

> **authorizeUrl**: `string`

###### completeAuth()

> **completeAuth**: (`codeOrUrl`) => `Promise`\<[`ClaudeAuthToken`](../auth.md#claudeauthtoken)\>

###### Parameters

###### codeOrUrl

`string`

###### Returns

`Promise`\<[`ClaudeAuthToken`](../auth.md#claudeauthtoken)\>

***

### ICopilotAuth

Defined in: [chat/server/auth-handler.ts:26](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/auth-handler.ts#L26)

Copilot auth class interface (matches CopilotAuth public API)

#### Methods

##### startDeviceFlow()

> **startDeviceFlow**(`options?`): `Promise`\<\{ `userCode`: `string`; `verificationUrl`: `string`; `waitForToken`: (`signal?`) => `Promise`\<[`CopilotAuthToken`](../auth.md#copilotauthtoken)\>; \}\>

Defined in: [chat/server/auth-handler.ts:27](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/auth-handler.ts#L27)

###### Parameters

###### options?

###### scopes?

`string`

###### signal?

`AbortSignal`

###### Returns

`Promise`\<\{ `userCode`: `string`; `verificationUrl`: `string`; `waitForToken`: (`signal?`) => `Promise`\<[`CopilotAuthToken`](../auth.md#copilotauthtoken)\>; \}\>

***

### ITokenStore

Defined in: [chat/server/token-store.ts:12](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L12)

Token storage interface for server-side token management

#### Methods

##### clear()

> **clear**(`provider`): `Promise`\<`void`\>

Defined in: [chat/server/token-store.ts:18](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L18)

Remove a specific provider's token.

###### Parameters

###### provider

`string`

###### Returns

`Promise`\<`void`\>

##### clearAll()

> **clearAll**(): `Promise`\<`void`\>

Defined in: [chat/server/token-store.ts:20](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L20)

Remove all stored tokens.

###### Returns

`Promise`\<`void`\>

##### dispose()?

> `optional` **dispose**(): `Promise`\<`void`\>

Defined in: [chat/server/token-store.ts:24](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L24)

Release any resources held by this store (optional).

###### Returns

`Promise`\<`void`\>

##### list()

> **list**(): `Promise`\<`string`[]\>

Defined in: [chat/server/token-store.ts:22](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L22)

List provider names that have saved tokens.

###### Returns

`Promise`\<`string`[]\>

##### load()

> **load**(`provider`): `Promise`\<[`AuthToken`](../auth.md#authtoken) \| `null`\>

Defined in: [chat/server/token-store.ts:16](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L16)

Load a previously saved token. Returns null if not found.

###### Parameters

###### provider

`string`

###### Returns

`Promise`\<[`AuthToken`](../auth.md#authtoken) \| `null`\>

##### save()

> **save**(`provider`, `token`): `Promise`\<`void`\>

Defined in: [chat/server/token-store.ts:14](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/token-store.ts#L14)

Save a token for a provider. Overwrites if exists.

###### Parameters

###### provider

`string`

###### token

[`AuthToken`](../auth.md#authtoken)

###### Returns

`Promise`\<`void`\>

***

### ManagedService

Defined in: [chat/server/service-manager.ts:28](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/service-manager.ts#L28)

Minimal IAgentService interface (avoids importing from main package)

#### Methods

##### dispose()

> **dispose**(): `void` \| `Promise`\<`void`\>

Defined in: [chat/server/service-manager.ts:29](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/service-manager.ts#L29)

###### Returns

`void` \| `Promise`\<`void`\>

***

### PooledAdapter

Defined in: [chat/server/adapter-pool.ts:30](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/adapter-pool.ts#L30)

Minimal adapter interface (avoids importing full IChatBackend)

#### Methods

##### dispose()

> **dispose**(): `void` \| `Promise`\<`void`\>

Defined in: [chat/server/adapter-pool.ts:31](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/adapter-pool.ts#L31)

###### Returns

`void` \| `Promise`\<`void`\>

***

### ProviderHandlerOptions

Defined in: [chat/server/provider-handler.ts:20](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-handler.ts#L20)

Configuration for createProviderHandler

#### Properties

##### providerStore

> **providerStore**: [`IProviderStore`](../chat.md#iproviderstore)

Defined in: [chat/server/provider-handler.ts:22](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-handler.ts#L22)

Provider storage implementation

***

### ReadableRequest

Defined in: [chat/server/handler.ts:20](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L20)

Minimal readable request interface (node:http IncomingMessage subset)

#### Properties

##### method?

> `readonly` `optional` **method**: `string`

Defined in: [chat/server/handler.ts:21](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L21)

##### url?

> `readonly` `optional` **url**: `string`

Defined in: [chat/server/handler.ts:22](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L22)

#### Methods

##### on()

###### Call Signature

> **on**(`event`, `listener`): `unknown`

Defined in: [chat/server/handler.ts:23](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L23)

###### Parameters

###### event

`"data"`

###### listener

(`chunk`) => `void`

###### Returns

`unknown`

###### Call Signature

> **on**(`event`, `listener`): `unknown`

Defined in: [chat/server/handler.ts:24](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L24)

###### Parameters

###### event

`"end"`

###### listener

() => `void`

###### Returns

`unknown`

***

### RequestContext

Defined in: [chat/server/request-context.ts:27](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/request-context.ts#L27)

Per-request context carrying backend, credentials, and model

#### Properties

##### backend

> **backend**: `string`

Defined in: [chat/server/request-context.ts:29](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/request-context.ts#L29)

Backend name (e.g. "copilot", "claude", "vercel-ai")

##### credentials

> **credentials**: [`AuthToken`](../auth.md#authtoken)

Defined in: [chat/server/request-context.ts:31](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/request-context.ts#L31)

Resolved authentication token

##### model

> **model**: `string`

Defined in: [chat/server/request-context.ts:33](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/request-context.ts#L33)

Model identifier from provider config

##### provider

> **provider**: [`ProviderConfig`](../chat.md#providerconfig)

Defined in: [chat/server/request-context.ts:35](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/request-context.ts#L35)

Original provider config for reference

***

### RequestContextDeps

Defined in: [chat/server/request-context.ts:39](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/request-context.ts#L39)

Dependencies for context resolution

#### Properties

##### providerStore

> **providerStore**: [`IProviderStore`](../chat.md#iproviderstore)

Defined in: [chat/server/request-context.ts:41](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/request-context.ts#L41)

Provider store to look up provider config

##### tokenStore

> **tokenStore**: [`ITokenStore`](#itokenstore)

Defined in: [chat/server/request-context.ts:43](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/request-context.ts#L43)

Token store to load credentials for the backend

***

### RouteContext

Defined in: [chat/server/routes/types.ts:25](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/routes/types.ts#L25)

Shared context passed to every route module.

#### Properties

##### heartbeatMs?

> `readonly` `optional` **heartbeatMs**: `number`

Defined in: [chat/server/routes/types.ts:28](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/routes/types.ts#L28)

##### hooks?

> `readonly` `optional` **hooks**: [`ChatServerHooks`](#chatserverhooks)

Defined in: [chat/server/routes/types.ts:29](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/routes/types.ts#L29)

##### maxBodySize

> `readonly` **maxBodySize**: `number`

Defined in: [chat/server/routes/types.ts:27](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/routes/types.ts#L27)

##### providerStore?

> `readonly` `optional` **providerStore**: [`IProviderStore`](../chat.md#iproviderstore)

Defined in: [chat/server/routes/types.ts:30](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/routes/types.ts#L30)

##### runtime

> `readonly` **runtime**: [`IChatRuntime`](runtime.md#ichatruntime)

Defined in: [chat/server/routes/types.ts:26](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/routes/types.ts#L26)

##### state

> `readonly` **state**: [`HandlerState`](#handlerstate)

Defined in: [chat/server/routes/types.ts:33](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/routes/types.ts#L33)

##### tokenStore?

> `readonly` `optional` **tokenStore**: [`ITokenStore`](#itokenstore)

Defined in: [chat/server/routes/types.ts:31](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/routes/types.ts#L31)

##### transportFactory?

> `readonly` `optional` **transportFactory**: [`TransportFactory`](#transportfactory-2)

Defined in: [chat/server/routes/types.ts:32](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/routes/types.ts#L32)

***

### ServiceManagerOptions

Defined in: [chat/server/service-manager.ts:36](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/service-manager.ts#L36)

Configuration for ServiceManager

#### Properties

##### createService()

> **createService**: (`backend`, `token`) => [`ManagedService`](#managedservice) \| `Promise`\<[`ManagedService`](#managedservice)\>

Defined in: [chat/server/service-manager.ts:41](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/service-manager.ts#L41)

Factory to create a service for a backend.
Called on every auth event (old service is disposed first).

###### Parameters

###### backend

`string`

###### token

[`AuthToken`](../auth.md#authtoken)

###### Returns

[`ManagedService`](#managedservice) \| `Promise`\<[`ManagedService`](#managedservice)\>

##### onTokenExpired()?

> `optional` **onTokenExpired**: (`backend`) => `void`

Defined in: [chat/server/service-manager.ts:52](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/service-manager.ts#L52)

Called when a token expires (before logout).

###### Parameters

###### backend

`string`

###### Returns

`void`

##### refreshFactory?

> `optional` **refreshFactory**: [`RefreshFactory`](#refreshfactory)

Defined in: [chat/server/service-manager.ts:48](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/service-manager.ts#L48)

Optional factory returning a refresh function per backend.
If provided and the token has expiresIn, a TokenRefreshManager is started.
On refresh → the stored token is updated and the service is recreated.
On expiry → handleLogout() for that backend is called.

##### refreshOptions?

> `optional` **refreshOptions**: `Partial`\<`Pick`\<[`TokenRefreshOptions`](../auth.md#tokenrefreshoptions), `"maxRetries"` \| `"refreshThreshold"` \| `"retryDelayMs"`\>\>

Defined in: [chat/server/service-manager.ts:50](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/service-manager.ts#L50)

Override TokenRefreshManager options (threshold, retries, etc.)

## Type Aliases

### AdapterFactory()

> **AdapterFactory**\<`T`\> = (`backend`) => `Promise`\<`T`\>

Defined in: [chat/server/adapter-pool.ts:35](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/adapter-pool.ts#L35)

Factory function to create an adapter for a given backend

#### Type Parameters

##### T

`T` *extends* [`PooledAdapter`](#pooledadapter) = [`PooledAdapter`](#pooledadapter)

#### Parameters

##### backend

`string`

#### Returns

`Promise`\<`T`\>

***

### AuthProvider

> **AuthProvider** = `"copilot"` \| `"claude"` \| `"vercel-ai"`

Defined in: [chat/server/auth-handler.ts:23](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/auth-handler.ts#L23)

Auth provider names recognized by the handler

***

### ChatRuntimeConfig

> **ChatRuntimeConfig** = [`ChatRuntimeOptions`](runtime.md#chatruntimeoptions)

Defined in: [chat/server/chat-server.ts:36](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L36)

Configuration for auto-creating a ChatRuntime from options.
Alternative to providing a pre-built IChatRuntime instance.
Uses the same shape as ChatRuntimeOptions from the runtime module.

***

### OnAuthCallback()

> **OnAuthCallback** = (`provider`, `token`) => `void` \| `Promise`\<`void`\>

Defined in: [chat/server/auth-handler.ts:49](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/auth-handler.ts#L49)

Callback invoked after successful authentication

#### Parameters

##### provider

[`AuthProvider`](#authprovider)

##### token

[`AuthToken`](../auth.md#authtoken)

#### Returns

`void` \| `Promise`\<`void`\>

***

### RefreshFactory()

> **RefreshFactory** = (`backend`) => (`token`) => `Promise`\<[`AuthToken`](../auth.md#authtoken)\> \| `undefined`

Defined in: [chat/server/service-manager.ts:33](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/service-manager.ts#L33)

Callback for building a token refresh function per backend

#### Parameters

##### backend

`string`

#### Returns

(`token`) => `Promise`\<[`AuthToken`](../auth.md#authtoken)\> \| `undefined`

***

### RequestHandler()

> **RequestHandler** = (`req`, `res`) => `Promise`\<`void`\>

Defined in: [chat/server/chat-server.ts:134](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L134)

Request handler type returned by createChatServer

#### Parameters

##### req

[`ReadableRequest`](#readablerequest)

##### res

[`WritableResponse`](backends.md#writableresponse)

#### Returns

`Promise`\<`void`\>

***

### RouteHandler()

> **RouteHandler** = (`method`, `path`, `req`, `res`, `ctx`) => `Promise`\<`boolean`\>

Defined in: [chat/server/routes/types.ts:40](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/routes/types.ts#L40)

A route module handler.
Returns `true` if the request was handled, `false` to try next module.

#### Parameters

##### method

`string`

##### path

`string`

##### req

[`ReadableRequest`](#readablerequest)

##### res

[`WritableResponse`](backends.md#writableresponse)

##### ctx

[`RouteContext`](#routecontext)

#### Returns

`Promise`\<`boolean`\>

***

### TransportFactory()

> **TransportFactory** = (`req`, `res`) => [`IChatTransport`](../chat.md#ichattransport)

Defined in: [chat/server/handler.ts:56](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L56)

Factory for creating a chat transport for a /send request.
Return an IChatTransport instance that will receive the event stream.
Default: SSEChatTransport.

#### Parameters

##### req

[`ReadableRequest`](#readablerequest)

##### res

[`WritableResponse`](backends.md#writableresponse)

#### Returns

[`IChatTransport`](../chat.md#ichattransport)

## Variables

### configRoutes

> `const` **configRoutes**: [`RouteHandler`](#routehandler)

Defined in: [chat/server/routes/config.ts:14](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/routes/config.ts#L14)

***

### DEFAULT\_PROVIDER\_MODELS

> `const` **DEFAULT\_PROVIDER\_MODELS**: `Record`\<`string`, `string`\>

Defined in: [chat/server/chat-server.ts:106](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L106)

Default model per backend for auto-created providers

***

### messageRoutes

> `const` **messageRoutes**: [`RouteHandler`](#routehandler)

Defined in: [chat/server/routes/messages.ts:18](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/routes/messages.ts#L18)

***

### providerRoutes

> `const` **providerRoutes**: [`RouteHandler`](#routehandler)

Defined in: [chat/server/routes/providers.ts:17](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/routes/providers.ts#L17)

***

### sessionRoutes

> `const` **sessionRoutes**: [`RouteHandler`](#routehandler)

Defined in: [chat/server/routes/sessions.ts:15](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/routes/sessions.ts#L15)

## Functions

### corsMiddleware()

> **corsMiddleware**(`options?`): (`req`, `res`) => `boolean`

Defined in: [chat/server/cors.ts:39](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/cors.ts#L39)

Create a CORS middleware function.

#### Parameters

##### options?

[`CorsOptions`](#corsoptions)

#### Returns

A function that sets CORS headers and handles OPTIONS preflight.
         Returns `true` if the request was fully handled (preflight),
         `false` if the caller should continue processing.

> (`req`, `res`): `boolean`

##### Parameters

###### req

`CorsRequest`

###### res

`CorsResponse`

##### Returns

`boolean`

***

### createAuthHandler()

> **createAuthHandler**(`options`): (`req`, `res`) => `Promise`\<`void`\>

Defined in: [chat/server/auth-handler.ts:104](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/auth-handler.ts#L104)

Create an HTTP request handler for server-mediated authentication.

#### Parameters

##### options

[`AuthHandlerOptions`](#authhandleroptions)

Auth handler configuration (token store, auth factories, callbacks)

#### Returns

Async request handler `(req, res) => Promise<void>`

> (`req`, `res`): `Promise`\<`void`\>

##### Parameters

###### req

[`ReadableRequest`](#readablerequest)

###### res

[`WritableResponse`](backends.md#writableresponse)

##### Returns

`Promise`\<`void`\>

#### Example

```ts
import { CopilotAuth, ClaudeAuth } from "@witqq/agent-sdk/auth";

const authHandler = createAuthHandler({
  tokenStore: new FileTokenStore({ directory: ".tokens" }),
  createCopilotAuth: () => new CopilotAuth(),
  createClaudeAuth: () => new ClaudeAuth(),
  onAuth: (provider, token) => {
    // Rebuild runtime with new credentials
  },
});
```

***

### createChatHandler()

> **createChatHandler**(`runtime`, `options?`): (`req`, `res`) => `Promise`\<`void`\>

Defined in: [chat/server/handler.ts:94](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/handler.ts#L94)

Create an HTTP request handler that maps RemoteChatClient contract
endpoints to IChatRuntime method calls.

Routes are handled by composable route modules (sessions, messages, config, providers).
Model state is managed in a shared HandlerState object.

#### Parameters

##### runtime

[`IChatRuntime`](runtime.md#ichatruntime)

##### options?

[`ChatHandlerOptions`](#chathandleroptions)

#### Returns

> (`req`, `res`): `Promise`\<`void`\>

##### Parameters

###### req

[`ReadableRequest`](#readablerequest)

###### res

[`WritableResponse`](backends.md#writableresponse)

##### Returns

`Promise`\<`void`\>

***

### createChatServer()

> **createChatServer**(`options`): [`RequestHandler`](#requesthandler)

Defined in: [chat/server/chat-server.ts:156](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/chat-server.ts#L156)

Create a combined HTTP request handler that routes to chat, auth, static, or 404.

#### Parameters

##### options

[`ChatServerOptions`](#chatserveroptions)

Server configuration

#### Returns

[`RequestHandler`](#requesthandler)

Async request handler

#### Example

```ts
import http from "node:http";
import { createChatServer } from "@witqq/agent-sdk/chat/server";

const handler = createChatServer({
  runtime,
  auth: { tokenStore },
  staticDir: "./public",
});

http.createServer(handler).listen(3000);
```

***

### createProviderHandler()

> **createProviderHandler**(`options`): (`req`, `res`) => `Promise`\<`void`\>

Defined in: [chat/server/provider-handler.ts:33](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/provider-handler.ts#L33)

Create an HTTP request handler for provider CRUD operations.

#### Parameters

##### options

[`ProviderHandlerOptions`](#providerhandleroptions)

Provider handler configuration

#### Returns

Async request handler `(req, res) => Promise<void>`

> (`req`, `res`): `Promise`\<`void`\>

##### Parameters

###### req

[`ReadableRequest`](#readablerequest)

###### res

[`WritableResponse`](backends.md#writableresponse)

##### Returns

`Promise`\<`void`\>

***

### json()

> **json**(`res`, `data`, `status?`): `void`

Defined in: [chat/server/utils.ts:54](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/utils.ts#L54)

Send a JSON response with given status code.

#### Parameters

##### res

[`WritableResponse`](backends.md#writableresponse)

##### data

`unknown`

##### status?

`number` = `200`

#### Returns

`void`

***

### readBody()

> **readBody**(`req`, `maxSize?`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [chat/server/utils.ts:21](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/utils.ts#L21)

Read and parse JSON request body with size limit.
Throws BodyParseError on oversized, malformed, or errored requests.

#### Parameters

##### req

[`ReadableRequest`](#readablerequest)

##### maxSize?

`number` = `1_048_576`

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### resolveRequestContext()

> **resolveRequestContext**(`providerId`, `deps`): `Promise`\<[`RequestContext`](#requestcontext)\>

Defined in: [chat/server/request-context.ts:56](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/server/request-context.ts#L56)

Resolve a providerId into a full RequestContext.

Flow: providerId → ProviderConfig (from providerStore) → AuthToken (from tokenStore) → RequestContext

#### Parameters

##### providerId

`string`

##### deps

[`RequestContextDeps`](#requestcontextdeps)

#### Returns

`Promise`\<[`RequestContext`](#requestcontext)\>

#### Throws

ChatError with PROVIDER_NOT_FOUND if provider doesn't exist

#### Throws

ChatError with AUTH_REQUIRED if no token found for the provider's backend

## References

### IProviderStore

Re-exports [IProviderStore](../chat.md#iproviderstore)

***

### ProviderConfig

Re-exports [ProviderConfig](../chat.md#providerconfig)

***

### WritableResponse

Re-exports [WritableResponse](backends.md#writableresponse)

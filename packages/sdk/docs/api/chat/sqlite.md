[**@witqq/agent-sdk**](../README.md)

***

[@witqq/agent-sdk](../README.md) / chat/sqlite

# chat/sqlite

## Classes

### SQLiteProviderStore

Defined in: [chat/sqlite/provider-store.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/provider-store.ts#L25)

Provider storage interface for server-side provider management

#### Implements

- [`IProviderStore`](../chat.md#iproviderstore)

#### Constructors

##### Constructor

> **new SQLiteProviderStore**(`db`): [`SQLiteProviderStore`](#sqliteproviderstore)

Defined in: [chat/sqlite/provider-store.ts:28](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/provider-store.ts#L28)

###### Parameters

###### db

`Database`

###### Returns

[`SQLiteProviderStore`](#sqliteproviderstore)

#### Methods

##### create()

> **create**(`config`): `Promise`\<`void`\>

Defined in: [chat/sqlite/provider-store.ts:33](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/provider-store.ts#L33)

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

Defined in: [chat/sqlite/provider-store.ts:61](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/provider-store.ts#L61)

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

Defined in: [chat/sqlite/provider-store.ts:40](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/provider-store.ts#L40)

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

Defined in: [chat/sqlite/provider-store.ts:65](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/provider-store.ts#L65)

List all providers.

###### Returns

`Promise`\<[`ProviderConfig`](../chat.md#providerconfig)[]\>

###### Implementation of

[`IProviderStore`](../chat.md#iproviderstore).[`list`](../chat.md#list)

##### update()

> **update**(`id`, `changes`): `Promise`\<`void`\>

Defined in: [chat/sqlite/provider-store.ts:45](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/provider-store.ts#L45)

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

### SQLiteSessionStore

Defined in: [chat/sqlite/session-store.ts:61](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/session-store.ts#L61)

Full session store interface — union of reader and writer.
Backward-compatible: all existing implementations continue to work.

#### Example

```typescript
const store = new InMemorySessionStore();
const session = await store.createSession({ config: { model: "gpt-4", backend: "vercel-ai" } });
await store.appendMessage(session.id, message);
const page = await store.loadMessages(session.id, { limit: 20, offset: 0 });
```

#### Implements

- [`IChatSessionStore`](sessions.md#ichatsessionstore)

#### Constructors

##### Constructor

> **new SQLiteSessionStore**(`db`): [`SQLiteSessionStore`](#sqlitesessionstore)

Defined in: [chat/sqlite/session-store.ts:64](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/session-store.ts#L64)

###### Parameters

###### db

`Database`

###### Returns

[`SQLiteSessionStore`](#sqlitesessionstore)

#### Methods

##### appendMessage()

> **appendMessage**(`sessionId`, `message`): `Promise`\<`void`\>

Defined in: [chat/sqlite/session-store.ts:137](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/session-store.ts#L137)

###### Parameters

###### sessionId

[`ChatId`](../chat.md#chatid)

###### message

[`ChatMessage`](../chat.md#chatmessage)

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IChatSessionStore`](sessions.md#ichatsessionstore).[`appendMessage`](sessions.md#appendmessage-1)

##### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [chat/sqlite/session-store.ts:243](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/session-store.ts#L243)

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IChatSessionStore`](sessions.md#ichatsessionstore).[`clear`](sessions.md#clear-1)

##### count()

> **count**(): `Promise`\<`number`\>

Defined in: [chat/sqlite/session-store.ts:239](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/session-store.ts#L239)

###### Returns

`Promise`\<`number`\>

###### Implementation of

[`IChatSessionStore`](sessions.md#ichatsessionstore).[`count`](sessions.md#count-1)

##### createSession()

> **createSession**(`options?`): `Promise`\<[`ChatSession`](../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\>\>

Defined in: [chat/sqlite/session-store.ts:71](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/session-store.ts#L71)

###### Parameters

###### options?

[`CreateSessionOptions`](sessions.md#createsessionoptions) = `{}`

###### Returns

`Promise`\<[`ChatSession`](../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\>\>

###### Implementation of

[`IChatSessionStore`](sessions.md#ichatsessionstore).[`createSession`](sessions.md#createsession-1)

##### deleteSession()

> **deleteSession**(`id`): `Promise`\<`void`\>

Defined in: [chat/sqlite/session-store.ts:132](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/session-store.ts#L132)

###### Parameters

###### id

[`ChatId`](../chat.md#chatid)

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IChatSessionStore`](sessions.md#ichatsessionstore).[`deleteSession`](sessions.md#deletesession-1)

##### getSession()

> **getSession**(`id`): `Promise`\<[`ChatSession`](../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\> \| `null`\>

Defined in: [chat/sqlite/session-store.ts:94](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/session-store.ts#L94)

###### Parameters

###### id

[`ChatId`](../chat.md#chatid)

###### Returns

`Promise`\<[`ChatSession`](../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\> \| `null`\>

###### Implementation of

[`IChatSessionStore`](sessions.md#ichatsessionstore).[`getSession`](sessions.md#getsession-1)

##### listSessions()

> **listSessions**(`options?`): `Promise`\<[`ChatSession`](../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

Defined in: [chat/sqlite/session-store.ts:102](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/session-store.ts#L102)

###### Parameters

###### options?

[`SessionListOptions`](sessions.md#sessionlistoptions)

###### Returns

`Promise`\<[`ChatSession`](../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

###### Implementation of

[`IChatSessionStore`](sessions.md#ichatsessionstore).[`listSessions`](sessions.md#listsessions-1)

##### loadMessages()

> **loadMessages**(`sessionId`, `options?`): `Promise`\<[`PaginatedMessages`](sessions.md#paginatedmessages)\>

Defined in: [chat/sqlite/session-store.ts:187](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/session-store.ts#L187)

###### Parameters

###### sessionId

[`ChatId`](../chat.md#chatid)

###### options?

###### limit?

`number`

###### offset?

`number`

###### Returns

`Promise`\<[`PaginatedMessages`](sessions.md#paginatedmessages)\>

###### Implementation of

[`IChatSessionStore`](sessions.md#ichatsessionstore).[`loadMessages`](sessions.md#loadmessages-1)

##### saveMessages()

> **saveMessages**(`sessionId`, `messages`): `Promise`\<`void`\>

Defined in: [chat/sqlite/session-store.ts:161](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/session-store.ts#L161)

###### Parameters

###### sessionId

[`ChatId`](../chat.md#chatid)

###### messages

[`ChatMessage`](../chat.md#chatmessage)\<`unknown`\>[]

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IChatSessionStore`](sessions.md#ichatsessionstore).[`saveMessages`](sessions.md#savemessages-1)

##### searchSessions()

> **searchSessions**(`options`): `Promise`\<[`ChatSession`](../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

Defined in: [chat/sqlite/session-store.ts:212](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/session-store.ts#L212)

###### Parameters

###### options

[`SessionSearchOptions`](sessions.md#sessionsearchoptions)

###### Returns

`Promise`\<[`ChatSession`](../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

###### Implementation of

[`IChatSessionStore`](sessions.md#ichatsessionstore).[`searchSessions`](sessions.md#searchsessions-1)

##### updateConfig()

> **updateConfig**(`id`, `config`): `Promise`\<`void`\>

Defined in: [chat/sqlite/session-store.ts:122](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/session-store.ts#L122)

###### Parameters

###### id

[`ChatId`](../chat.md#chatid)

###### config

`Partial`\<[`ChatSessionConfig`](../chat.md#chatsessionconfig-1)\>

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IChatSessionStore`](sessions.md#ichatsessionstore).[`updateConfig`](sessions.md#updateconfig-1)

##### updateTitle()

> **updateTitle**(`id`, `title`): `Promise`\<`void`\>

Defined in: [chat/sqlite/session-store.ts:115](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/session-store.ts#L115)

###### Parameters

###### id

[`ChatId`](../chat.md#chatid)

###### title

`string`

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IChatSessionStore`](sessions.md#ichatsessionstore).[`updateTitle`](sessions.md#updatetitle-1)

***

### SQLiteTokenStore

Defined in: [chat/sqlite/token-store.ts:24](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/token-store.ts#L24)

Token storage interface for server-side token management

#### Implements

- [`ITokenStore`](server.md#itokenstore)

#### Constructors

##### Constructor

> **new SQLiteTokenStore**(`db`): [`SQLiteTokenStore`](#sqlitetokenstore)

Defined in: [chat/sqlite/token-store.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/token-store.ts#L27)

###### Parameters

###### db

`Database`

###### Returns

[`SQLiteTokenStore`](#sqlitetokenstore)

#### Methods

##### clear()

> **clear**(`provider`): `Promise`\<`void`\>

Defined in: [chat/sqlite/token-store.ts:44](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/token-store.ts#L44)

Remove a specific provider's token.

###### Parameters

###### provider

`string`

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`ITokenStore`](server.md#itokenstore).[`clear`](server.md#clear-2)

##### clearAll()

> **clearAll**(): `Promise`\<`void`\>

Defined in: [chat/sqlite/token-store.ts:48](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/token-store.ts#L48)

Remove all stored tokens.

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`ITokenStore`](server.md#itokenstore).[`clearAll`](server.md#clearall-2)

##### list()

> **list**(): `Promise`\<`string`[]\>

Defined in: [chat/sqlite/token-store.ts:52](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/token-store.ts#L52)

List provider names that have saved tokens.

###### Returns

`Promise`\<`string`[]\>

###### Implementation of

[`ITokenStore`](server.md#itokenstore).[`list`](server.md#list-4)

##### load()

> **load**(`provider`): `Promise`\<[`AuthToken`](../auth.md#authtoken) \| `null`\>

Defined in: [chat/sqlite/token-store.ts:39](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/token-store.ts#L39)

Load a previously saved token. Returns null if not found.

###### Parameters

###### provider

`string`

###### Returns

`Promise`\<[`AuthToken`](../auth.md#authtoken) \| `null`\>

###### Implementation of

[`ITokenStore`](server.md#itokenstore).[`load`](server.md#load-2)

##### save()

> **save**(`provider`, `token`): `Promise`\<`void`\>

Defined in: [chat/sqlite/token-store.ts:32](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/token-store.ts#L32)

Save a token for a provider. Overwrites if exists.

###### Parameters

###### provider

`string`

###### token

[`AuthToken`](../auth.md#authtoken)

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`ITokenStore`](server.md#itokenstore).[`save`](server.md#save-2)

## Interfaces

### Migration

Defined in: [chat/sqlite/migrations.ts:17](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/migrations.ts#L17)

#### Properties

##### description

> **description**: `string`

Defined in: [chat/sqlite/migrations.ts:21](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/migrations.ts#L21)

Human-readable description

##### up()

> **up**: (`db`) => `void`

Defined in: [chat/sqlite/migrations.ts:23](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/migrations.ts#L23)

DDL statements to apply. Runs inside a transaction.

###### Parameters

###### db

`Database`

###### Returns

`void`

##### version

> **version**: `number`

Defined in: [chat/sqlite/migrations.ts:19](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/migrations.ts#L19)

Sequential version number (1-based)

***

### SQLiteStorage

Defined in: [chat/sqlite/factory.ts:35](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/factory.ts#L35)

#### Properties

##### db

> **db**: `Database`

Defined in: [chat/sqlite/factory.ts:37](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/factory.ts#L37)

The underlying better-sqlite3 Database instance

##### providerStore

> **providerStore**: [`IProviderStore`](../chat.md#iproviderstore)

Defined in: [chat/sqlite/factory.ts:41](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/factory.ts#L41)

Provider store for provider configurations

##### sessionStore

> **sessionStore**: [`IChatSessionStore`](sessions.md#ichatsessionstore)

Defined in: [chat/sqlite/factory.ts:39](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/factory.ts#L39)

Session store for chat sessions and messages

##### tokenStore

> **tokenStore**: [`ITokenStore`](server.md#itokenstore)

Defined in: [chat/sqlite/factory.ts:43](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/factory.ts#L43)

Token store for auth tokens

***

### SQLiteStorageOptions

Defined in: [chat/sqlite/factory.ts:28](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/factory.ts#L28)

#### Properties

##### db?

> `optional` **db**: `Database`

Defined in: [chat/sqlite/factory.ts:32](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/factory.ts#L32)

Optional pre-created Database instance. If provided, dbPath is ignored.

##### dbPath

> **dbPath**: `string`

Defined in: [chat/sqlite/factory.ts:30](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/factory.ts#L30)

Path to SQLite database file. Use ":memory:" for in-memory database.

## Variables

### migrations

> `const` **migrations**: readonly [`Migration`](#migration)[]

Defined in: [chat/sqlite/migrations.ts:42](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/migrations.ts#L42)

Migration registry. Append new migrations here.
Version numbers must be sequential (1, 2, 3, ...).

## Functions

### createSQLiteStorage()

> **createSQLiteStorage**(`pathOrOptions`): [`SQLiteStorage`](#sqlitestorage)

Defined in: [chat/sqlite/factory.ts:59](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/factory.ts#L59)

Create all three SQLite stores sharing a single database.

Requires `better-sqlite3` as a peer dependency.
Schema tables are auto-created on first use.

#### Parameters

##### pathOrOptions

Database file path string, or options object

`string` | [`SQLiteStorageOptions`](#sqlitestorageoptions)

#### Returns

[`SQLiteStorage`](#sqlitestorage)

Object with db, sessionStore, providerStore, tokenStore

#### Throws

If better-sqlite3 is not installed

***

### getSchemaVersion()

> **getSchemaVersion**(`db`): `number`

Defined in: [chat/sqlite/migrations.ts:102](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/migrations.ts#L102)

Get current schema version (0 if no migrations applied).

#### Parameters

##### db

`Database`

#### Returns

`number`

***

### runMigrations()

> **runMigrations**(`db`): `void`

Defined in: [chat/sqlite/migrations.ts:117](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sqlite/migrations.ts#L117)

Apply pending migrations sequentially. Each runs in a transaction.

Safe to call multiple times — already-applied migrations are skipped.
For existing databases without schema_version table, detects current
tables and fast-forwards to the matching version.

#### Parameters

##### db

`Database`

#### Returns

`void`

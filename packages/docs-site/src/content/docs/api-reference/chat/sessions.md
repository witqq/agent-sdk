---
title: "Chat Sessions"
description: "Session store interfaces and in-memory implementation"
sidebar:
  order: 25
---
# chat/sessions

## Classes

### FileSessionStore

Defined in: [chat/sessions.ts:292](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L292)

File-based session store. Each session is a JSON file on disk.
Uses `FileStorage` internally.

#### Example

```typescript
const store = new FileSessionStore({ directory: "./data/sessions" });
const session = await store.createSession({
  config: { model: "claude-3", backend: "claude" },
});
```

#### Extends

- `BaseSessionStore`

#### Constructors

##### Constructor

> **new FileSessionStore**(`options`): [`FileSessionStore`](#filesessionstore)

Defined in: [chat/sessions.ts:293](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L293)

###### Parameters

###### options

[`FileSessionStoreOptions`](#filesessionstoreoptions)

###### Returns

[`FileSessionStore`](#filesessionstore)

###### Overrides

`BaseSessionStore.constructor`

#### Properties

##### adapter

> `protected` `readonly` **adapter**: [`IStorageAdapter`](/api-reference/chat/storage/#istorageadapter)\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>\>

Defined in: [chat/sessions.ts:116](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L116)

###### Inherited from

`BaseSessionStore.adapter`

#### Methods

##### appendMessage()

> **appendMessage**(`sessionId`, `message`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:179](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L179)

###### Parameters

###### sessionId

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### message

[`ChatMessage`](/api-reference/chat/index-exports/#chatmessage)

###### Returns

`Promise`\<`void`\>

###### Inherited from

`BaseSessionStore.appendMessage`

##### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:247](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L247)

###### Returns

`Promise`\<`void`\>

###### Inherited from

`BaseSessionStore.clear`

##### count()

> **count**(): `Promise`\<`number`\>

Defined in: [chat/sessions.ts:243](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L243)

###### Returns

`Promise`\<`number`\>

###### Inherited from

`BaseSessionStore.count`

##### createSession()

> **createSession**(`options`): `Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>\>

Defined in: [chat/sessions.ts:118](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L118)

###### Parameters

###### options

[`CreateSessionOptions`](#createsessionoptions)

###### Returns

`Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>\>

###### Inherited from

`BaseSessionStore.createSession`

##### deleteSession()

> **deleteSession**(`id`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:175](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L175)

###### Parameters

###### id

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### Returns

`Promise`\<`void`\>

###### Inherited from

`BaseSessionStore.deleteSession`

##### getSession()

> **getSession**(`id`): `Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\> \| `null`\>

Defined in: [chat/sessions.ts:144](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L144)

###### Parameters

###### id

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### Returns

`Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\> \| `null`\>

###### Inherited from

`BaseSessionStore.getSession`

##### listSessions()

> **listSessions**(`options?`): `Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

Defined in: [chat/sessions.ts:148](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L148)

###### Parameters

###### options?

[`SessionListOptions`](#sessionlistoptions)

###### Returns

`Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

###### Inherited from

`BaseSessionStore.listSessions`

##### loadMessages()

> **loadMessages**(`sessionId`, `options?`): `Promise`\<[`PaginatedMessages`](#paginatedmessages)\>

Defined in: [chat/sessions.ts:204](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L204)

###### Parameters

###### sessionId

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### options?

###### limit?

`number`

###### offset?

`number`

###### Returns

`Promise`\<[`PaginatedMessages`](#paginatedmessages)\>

###### Inherited from

`BaseSessionStore.loadMessages`

##### saveMessages()

> **saveMessages**(`sessionId`, `messages`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:190](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L190)

###### Parameters

###### sessionId

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### messages

[`ChatMessage`](/api-reference/chat/index-exports/#chatmessage)\<`unknown`\>[]

###### Returns

`Promise`\<`void`\>

###### Inherited from

`BaseSessionStore.saveMessages`

##### searchSessions()

> **searchSessions**(`options`): `Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

Defined in: [chat/sessions.ts:223](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L223)

###### Parameters

###### options

[`SessionSearchOptions`](#sessionsearchoptions)

###### Returns

`Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

###### Inherited from

`BaseSessionStore.searchSessions`

##### updateConfig()

> **updateConfig**(`id`, `config`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:162](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L162)

###### Parameters

###### id

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### config

`Partial`\<[`ChatSessionConfig`](/api-reference/chat/index-exports/#chatsessionconfig-1)\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

`BaseSessionStore.updateConfig`

##### updateTitle()

> **updateTitle**(`id`, `title`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:152](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L152)

###### Parameters

###### id

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### title

`string`

###### Returns

`Promise`\<`void`\>

###### Inherited from

`BaseSessionStore.updateTitle`

***

### InMemorySessionStore

Defined in: [chat/sessions.ts:266](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L266)

In-memory session store. Data is lost when the process exits.
Uses `InMemoryStorage` internally.

#### Example

```typescript
const store = new InMemorySessionStore();
const session = await store.createSession({
  config: { model: "gpt-4", backend: "vercel-ai" },
});
```

#### Extends

- `BaseSessionStore`

#### Constructors

##### Constructor

> **new InMemorySessionStore**(): [`InMemorySessionStore`](#inmemorysessionstore)

Defined in: [chat/sessions.ts:267](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L267)

###### Returns

[`InMemorySessionStore`](#inmemorysessionstore)

###### Overrides

`BaseSessionStore.constructor`

#### Properties

##### adapter

> `protected` `readonly` **adapter**: [`IStorageAdapter`](/api-reference/chat/storage/#istorageadapter)\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>\>

Defined in: [chat/sessions.ts:116](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L116)

###### Inherited from

`BaseSessionStore.adapter`

#### Methods

##### appendMessage()

> **appendMessage**(`sessionId`, `message`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:179](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L179)

###### Parameters

###### sessionId

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### message

[`ChatMessage`](/api-reference/chat/index-exports/#chatmessage)

###### Returns

`Promise`\<`void`\>

###### Inherited from

`BaseSessionStore.appendMessage`

##### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:247](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L247)

###### Returns

`Promise`\<`void`\>

###### Inherited from

`BaseSessionStore.clear`

##### count()

> **count**(): `Promise`\<`number`\>

Defined in: [chat/sessions.ts:243](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L243)

###### Returns

`Promise`\<`number`\>

###### Inherited from

`BaseSessionStore.count`

##### createSession()

> **createSession**(`options`): `Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>\>

Defined in: [chat/sessions.ts:118](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L118)

###### Parameters

###### options

[`CreateSessionOptions`](#createsessionoptions)

###### Returns

`Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>\>

###### Inherited from

`BaseSessionStore.createSession`

##### deleteSession()

> **deleteSession**(`id`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:175](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L175)

###### Parameters

###### id

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### Returns

`Promise`\<`void`\>

###### Inherited from

`BaseSessionStore.deleteSession`

##### getSession()

> **getSession**(`id`): `Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\> \| `null`\>

Defined in: [chat/sessions.ts:144](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L144)

###### Parameters

###### id

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### Returns

`Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\> \| `null`\>

###### Inherited from

`BaseSessionStore.getSession`

##### listSessions()

> **listSessions**(`options?`): `Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

Defined in: [chat/sessions.ts:148](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L148)

###### Parameters

###### options?

[`SessionListOptions`](#sessionlistoptions)

###### Returns

`Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

###### Inherited from

`BaseSessionStore.listSessions`

##### loadMessages()

> **loadMessages**(`sessionId`, `options?`): `Promise`\<[`PaginatedMessages`](#paginatedmessages)\>

Defined in: [chat/sessions.ts:204](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L204)

###### Parameters

###### sessionId

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### options?

###### limit?

`number`

###### offset?

`number`

###### Returns

`Promise`\<[`PaginatedMessages`](#paginatedmessages)\>

###### Inherited from

`BaseSessionStore.loadMessages`

##### saveMessages()

> **saveMessages**(`sessionId`, `messages`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:190](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L190)

###### Parameters

###### sessionId

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### messages

[`ChatMessage`](/api-reference/chat/index-exports/#chatmessage)\<`unknown`\>[]

###### Returns

`Promise`\<`void`\>

###### Inherited from

`BaseSessionStore.saveMessages`

##### searchSessions()

> **searchSessions**(`options`): `Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

Defined in: [chat/sessions.ts:223](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L223)

###### Parameters

###### options

[`SessionSearchOptions`](#sessionsearchoptions)

###### Returns

`Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

###### Inherited from

`BaseSessionStore.searchSessions`

##### updateConfig()

> **updateConfig**(`id`, `config`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:162](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L162)

###### Parameters

###### id

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### config

`Partial`\<[`ChatSessionConfig`](/api-reference/chat/index-exports/#chatsessionconfig-1)\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

`BaseSessionStore.updateConfig`

##### updateTitle()

> **updateTitle**(`id`, `title`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:152](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L152)

###### Parameters

###### id

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### title

`string`

###### Returns

`Promise`\<`void`\>

###### Inherited from

`BaseSessionStore.updateTitle`

## Interfaces

### CreateSessionOptions

Defined in: [chat/sessions.ts:23](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L23)

Options for creating a new session

#### Type Parameters

##### TCustom

`TCustom` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Properties

##### config?

> `optional` **config**: `Partial`\<[`ChatSessionConfig`](/api-reference/chat/index-exports/#chatsessionconfig-1)\>

Defined in: [chat/sessions.ts:27](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L27)

Session configuration (optional — runtime defaults used when omitted)

##### custom?

> `optional` **custom**: `TCustom`

Defined in: [chat/sessions.ts:31](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L31)

Custom metadata

##### tags?

> `optional` **tags**: `string`[]

Defined in: [chat/sessions.ts:29](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L29)

Initial tags

##### title?

> `optional` **title**: `string`

Defined in: [chat/sessions.ts:25](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L25)

Session title (defaults to "Untitled")

***

### FileSessionStoreOptions

Defined in: [chat/sessions.ts:275](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L275)

Configuration for FileSessionStore

#### Properties

##### directory

> **directory**: `string`

Defined in: [chat/sessions.ts:277](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L277)

Directory to store session JSON files

***

### IChatSessionStore

Defined in: [chat/sessions.ts:107](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L107)

Full session store interface — union of reader and writer.
Backward-compatible: all existing implementations continue to work.

#### Example

```typescript
const store = new InMemorySessionStore();
const session = await store.createSession({ config: { model: "gpt-4", backend: "vercel-ai" } });
await store.appendMessage(session.id, message);
const page = await store.loadMessages(session.id, { limit: 20, offset: 0 });
```

#### Extends

- [`ISessionReader`](#isessionreader).[`ISessionWriter`](#isessionwriter)

#### Methods

##### appendMessage()

> **appendMessage**(`sessionId`, `message`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:88](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L88)

###### Parameters

###### sessionId

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### message

[`ChatMessage`](/api-reference/chat/index-exports/#chatmessage)

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`ISessionWriter`](#isessionwriter).[`appendMessage`](#appendmessage-3)

##### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:90](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L90)

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`ISessionWriter`](#isessionwriter).[`clear`](#clear-3)

##### count()

> **count**(): `Promise`\<`number`\>

Defined in: [chat/sessions.ts:76](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L76)

###### Returns

`Promise`\<`number`\>

###### Inherited from

[`ISessionReader`](#isessionreader).[`count`](#count-3)

##### createSession()

> **createSession**(`options`): `Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>\>

Defined in: [chat/sessions.ts:84](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L84)

###### Parameters

###### options

[`CreateSessionOptions`](#createsessionoptions)

###### Returns

`Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>\>

###### Inherited from

[`ISessionWriter`](#isessionwriter).[`createSession`](#createsession-3)

##### deleteSession()

> **deleteSession**(`id`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:87](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L87)

###### Parameters

###### id

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`ISessionWriter`](#isessionwriter).[`deleteSession`](#deletesession-3)

##### dispose()?

> `optional` **dispose**(): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:92](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L92)

Release any resources held by this store (optional).

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`ISessionWriter`](#isessionwriter).[`dispose`](#dispose-1)

##### getSession()

> **getSession**(`id`): `Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\> \| `null`\>

Defined in: [chat/sessions.ts:69](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L69)

###### Parameters

###### id

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### Returns

`Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\> \| `null`\>

###### Inherited from

[`ISessionReader`](#isessionreader).[`getSession`](#getsession-3)

##### listSessions()

> **listSessions**(`options?`): `Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

Defined in: [chat/sessions.ts:70](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L70)

###### Parameters

###### options?

[`SessionListOptions`](#sessionlistoptions)

###### Returns

`Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

###### Inherited from

[`ISessionReader`](#isessionreader).[`listSessions`](#listsessions-3)

##### loadMessages()

> **loadMessages**(`sessionId`, `options?`): `Promise`\<[`PaginatedMessages`](#paginatedmessages)\>

Defined in: [chat/sessions.ts:71](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L71)

###### Parameters

###### sessionId

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### options?

###### limit?

`number`

###### offset?

`number`

###### Returns

`Promise`\<[`PaginatedMessages`](#paginatedmessages)\>

###### Inherited from

[`ISessionReader`](#isessionreader).[`loadMessages`](#loadmessages-3)

##### saveMessages()

> **saveMessages**(`sessionId`, `messages`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:89](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L89)

###### Parameters

###### sessionId

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### messages

[`ChatMessage`](/api-reference/chat/index-exports/#chatmessage)\<`unknown`\>[]

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`ISessionWriter`](#isessionwriter).[`saveMessages`](#savemessages-3)

##### searchSessions()

> **searchSessions**(`options`): `Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

Defined in: [chat/sessions.ts:75](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L75)

###### Parameters

###### options

[`SessionSearchOptions`](#sessionsearchoptions)

###### Returns

`Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

###### Inherited from

[`ISessionReader`](#isessionreader).[`searchSessions`](#searchsessions-3)

##### updateConfig()

> **updateConfig**(`id`, `config`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:86](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L86)

###### Parameters

###### id

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### config

`Partial`\<[`ChatSessionConfig`](/api-reference/chat/index-exports/#chatsessionconfig-1)\>

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`ISessionWriter`](#isessionwriter).[`updateConfig`](#updateconfig-3)

##### updateTitle()

> **updateTitle**(`id`, `title`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:85](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L85)

###### Parameters

###### id

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### title

`string`

###### Returns

`Promise`\<`void`\>

###### Inherited from

[`ISessionWriter`](#isessionwriter).[`updateTitle`](#updatetitle-3)

***

### ISessionReader

Defined in: [chat/sessions.ts:68](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L68)

Read-only session operations.
Consumers needing read-only access (dashboards, analytics) implement only this.

#### Extended by

- [`IChatSessionStore`](#ichatsessionstore)

#### Methods

##### count()

> **count**(): `Promise`\<`number`\>

Defined in: [chat/sessions.ts:76](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L76)

###### Returns

`Promise`\<`number`\>

##### getSession()

> **getSession**(`id`): `Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\> \| `null`\>

Defined in: [chat/sessions.ts:69](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L69)

###### Parameters

###### id

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### Returns

`Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\> \| `null`\>

##### listSessions()

> **listSessions**(`options?`): `Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

Defined in: [chat/sessions.ts:70](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L70)

###### Parameters

###### options?

[`SessionListOptions`](#sessionlistoptions)

###### Returns

`Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

##### loadMessages()

> **loadMessages**(`sessionId`, `options?`): `Promise`\<[`PaginatedMessages`](#paginatedmessages)\>

Defined in: [chat/sessions.ts:71](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L71)

###### Parameters

###### sessionId

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### options?

###### limit?

`number`

###### offset?

`number`

###### Returns

`Promise`\<[`PaginatedMessages`](#paginatedmessages)\>

##### searchSessions()

> **searchSessions**(`options`): `Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

Defined in: [chat/sessions.ts:75](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L75)

###### Parameters

###### options

[`SessionSearchOptions`](#sessionsearchoptions)

###### Returns

`Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>[]\>

***

### ISessionWriter

Defined in: [chat/sessions.ts:83](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L83)

Write/mutate session operations.
Consumers needing full access implement both ISessionReader & ISessionWriter.

#### Extended by

- [`IChatSessionStore`](#ichatsessionstore)

#### Methods

##### appendMessage()

> **appendMessage**(`sessionId`, `message`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:88](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L88)

###### Parameters

###### sessionId

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### message

[`ChatMessage`](/api-reference/chat/index-exports/#chatmessage)

###### Returns

`Promise`\<`void`\>

##### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:90](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L90)

###### Returns

`Promise`\<`void`\>

##### createSession()

> **createSession**(`options`): `Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>\>

Defined in: [chat/sessions.ts:84](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L84)

###### Parameters

###### options

[`CreateSessionOptions`](#createsessionoptions)

###### Returns

`Promise`\<[`ChatSession`](/api-reference/chat/index-exports/#chatsession)\<`Record`\<`string`, `unknown`\>\>\>

##### deleteSession()

> **deleteSession**(`id`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:87](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L87)

###### Parameters

###### id

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### Returns

`Promise`\<`void`\>

##### dispose()?

> `optional` **dispose**(): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:92](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L92)

Release any resources held by this store (optional).

###### Returns

`Promise`\<`void`\>

##### saveMessages()

> **saveMessages**(`sessionId`, `messages`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:89](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L89)

###### Parameters

###### sessionId

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### messages

[`ChatMessage`](/api-reference/chat/index-exports/#chatmessage)\<`unknown`\>[]

###### Returns

`Promise`\<`void`\>

##### updateConfig()

> **updateConfig**(`id`, `config`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:86](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L86)

###### Parameters

###### id

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### config

`Partial`\<[`ChatSessionConfig`](/api-reference/chat/index-exports/#chatsessionconfig-1)\>

###### Returns

`Promise`\<`void`\>

##### updateTitle()

> **updateTitle**(`id`, `title`): `Promise`\<`void`\>

Defined in: [chat/sessions.ts:85](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L85)

###### Parameters

###### id

[`ChatId`](/api-reference/chat/index-exports/#chatid)

###### title

`string`

###### Returns

`Promise`\<`void`\>

***

### PaginatedMessages

Defined in: [chat/sessions.ts:35](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L35)

Paginated result of messages

#### Properties

##### hasMore

> **hasMore**: `boolean`

Defined in: [chat/sessions.ts:41](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L41)

Whether there are more messages after this page

##### messages

> **messages**: [`ChatMessage`](/api-reference/chat/index-exports/#chatmessage)\<`unknown`\>[]

Defined in: [chat/sessions.ts:37](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L37)

Messages in this page

##### total

> **total**: `number`

Defined in: [chat/sessions.ts:39](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L39)

Total number of messages in session

***

### SessionListOptions

Defined in: [chat/sessions.ts:45](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L45)

Options for listing sessions

#### Properties

##### filter()?

> `optional` **filter**: (`session`) => `boolean`

Defined in: [chat/sessions.ts:47](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L47)

Filter predicate

###### Parameters

###### session

[`ChatSession`](/api-reference/chat/index-exports/#chatsession)

###### Returns

`boolean`

##### limit?

> `optional` **limit**: `number`

Defined in: [chat/sessions.ts:51](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L51)

Maximum number of sessions to return

##### offset?

> `optional` **offset**: `number`

Defined in: [chat/sessions.ts:53](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L53)

Number of sessions to skip

##### sort()?

> `optional` **sort**: (`a`, `b`) => `number`

Defined in: [chat/sessions.ts:49](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L49)

Sort comparator

###### Parameters

###### a

[`ChatSession`](/api-reference/chat/index-exports/#chatsession)

###### b

[`ChatSession`](/api-reference/chat/index-exports/#chatsession)

###### Returns

`number`

***

### SessionSearchOptions

Defined in: [chat/sessions.ts:57](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L57)

Search options for finding sessions

#### Properties

##### limit?

> `optional` **limit**: `number`

Defined in: [chat/sessions.ts:61](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L61)

Maximum results (default: 20)

##### query

> **query**: `string`

Defined in: [chat/sessions.ts:59](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/sessions.ts#L59)

Text query to match against title and message content

## References

### StorageError

Re-exports [StorageError](/api-reference/chat/storage/#storageerror)

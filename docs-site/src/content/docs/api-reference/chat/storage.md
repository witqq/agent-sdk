---
title: "Chat Storage"
description: "Persistent chat storage interfaces"
sidebar:
  order: 26
---
# chat/storage

## Classes

### FileStorage

Defined in: [chat/storage.ts:263](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L263)

File-based storage adapter that persists each item as a JSON file.
Suitable for local applications, CLI tools, and development.
Creates the storage directory if it doesn't exist.

#### Example

```typescript
const store = new FileStorage<ChatSession>({
  directory: "./data/sessions",
});
await store.create("session-1", mySession);
```

#### Type Parameters

##### T

`T`

The type of stored items (must be JSON-serializable)

#### Implements

- [`IStorageAdapter`](#istorageadapter)\<`T`\>

#### Constructors

##### Constructor

> **new FileStorage**\<`T`\>(`options`): [`FileStorage`](#filestorage)\<`T`\>

Defined in: [chat/storage.ts:267](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L267)

###### Parameters

###### options

[`FileStorageOptions`](#filestorageoptions)

###### Returns

[`FileStorage`](#filestorage)\<`T`\>

#### Methods

##### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [chat/storage.ts:361](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L361)

Remove all items from storage.

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IStorageAdapter`](#istorageadapter).[`clear`](#clear-2)

##### count()

> **count**(): `Promise`\<`number`\>

Defined in: [chat/storage.ts:353](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L353)

Return the number of stored items.

###### Returns

`Promise`\<`number`\>

Count of items

###### Implementation of

[`IStorageAdapter`](#istorageadapter).[`count`](#count-2)

##### create()

> **create**(`key`, `item`): `Promise`\<`void`\>

Defined in: [chat/storage.ts:312](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L312)

Create a new item. Throws `StorageError` with code `DUPLICATE_KEY` if key exists.

###### Parameters

###### key

`string`

Unique identifier

###### item

`T`

Data to store

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IStorageAdapter`](#istorageadapter).[`create`](#create-2)

##### delete()

> **delete**(`key`): `Promise`\<`void`\>

Defined in: [chat/storage.ts:336](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L336)

Delete an item by key. Throws `StorageError` with code `NOT_FOUND` if key missing.

###### Parameters

###### key

`string`

Unique identifier

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IStorageAdapter`](#istorageadapter).[`delete`](#delete-2)

##### get()

> **get**(`key`): `Promise`\<`T` \| `null`\>

Defined in: [chat/storage.ts:274](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L274)

Retrieve an item by key.

###### Parameters

###### key

`string`

Unique identifier

###### Returns

`Promise`\<`T` \| `null`\>

The item, or `null` if not found

###### Implementation of

[`IStorageAdapter`](#istorageadapter).[`get`](#get-2)

##### has()

> **has**(`key`): `Promise`\<`boolean`\>

Defined in: [chat/storage.ts:348](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L348)

Check whether a key exists.

###### Parameters

###### key

`string`

Unique identifier

###### Returns

`Promise`\<`boolean`\>

`true` if key exists

###### Implementation of

[`IStorageAdapter`](#istorageadapter).[`has`](#has-2)

##### list()

> **list**(`options?`): `Promise`\<`T`[]\>

Defined in: [chat/storage.ts:283](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L283)

List items with optional filtering, sorting, and pagination.

###### Parameters

###### options?

[`ListOptions`](#listoptions)\<`T`\>

Filter, sort, limit, offset options

###### Returns

`Promise`\<`T`[]\>

Array of matching items

###### Implementation of

[`IStorageAdapter`](#istorageadapter).[`list`](#list-2)

##### update()

> **update**(`key`, `item`): `Promise`\<`void`\>

Defined in: [chat/storage.ts:324](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L324)

Update an existing item. Throws `StorageError` with code `NOT_FOUND` if key missing.

###### Parameters

###### key

`string`

Unique identifier

###### item

`T`

Updated data

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IStorageAdapter`](#istorageadapter).[`update`](#update-2)

***

### InMemoryStorage

Defined in: [chat/storage.ts:158](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L158)

In-memory storage adapter backed by a `Map`.
Suitable for development, testing, and short-lived processes.
Data is lost when the process exits.

#### Example

```typescript
const store = new InMemoryStorage<{ name: string }>();
await store.create("k1", { name: "Alice" });
await store.create("k2", { name: "Bob" });
const items = await store.list({ filter: i => i.name.startsWith("A") });
// [{ name: "Alice" }]
```

#### Type Parameters

##### T

`T`

The type of stored items

#### Implements

- [`IStorageAdapter`](#istorageadapter)\<`T`\>

#### Constructors

##### Constructor

> **new InMemoryStorage**\<`T`\>(): [`InMemoryStorage`](#inmemorystorage)\<`T`\>

###### Returns

[`InMemoryStorage`](#inmemorystorage)\<`T`\>

#### Methods

##### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [chat/storage.ts:231](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L231)

Remove all items from storage.

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IStorageAdapter`](#istorageadapter).[`clear`](#clear-2)

##### count()

> **count**(): `Promise`\<`number`\>

Defined in: [chat/storage.ts:226](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L226)

Return the number of stored items.

###### Returns

`Promise`\<`number`\>

Count of items

###### Implementation of

[`IStorageAdapter`](#istorageadapter).[`count`](#count-2)

##### create()

> **create**(`key`, `item`): `Promise`\<`void`\>

Defined in: [chat/storage.ts:188](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L188)

Create a new item. Throws `StorageError` with code `DUPLICATE_KEY` if key exists.

###### Parameters

###### key

`string`

Unique identifier

###### item

`T`

Data to store

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IStorageAdapter`](#istorageadapter).[`create`](#create-2)

##### delete()

> **delete**(`key`): `Promise`\<`void`\>

Defined in: [chat/storage.ts:210](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L210)

Delete an item by key. Throws `StorageError` with code `NOT_FOUND` if key missing.

###### Parameters

###### key

`string`

Unique identifier

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IStorageAdapter`](#istorageadapter).[`delete`](#delete-2)

##### get()

> **get**(`key`): `Promise`\<`T` \| `null`\>

Defined in: [chat/storage.ts:162](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L162)

Retrieve an item by key.

###### Parameters

###### key

`string`

Unique identifier

###### Returns

`Promise`\<`T` \| `null`\>

The item, or `null` if not found

###### Implementation of

[`IStorageAdapter`](#istorageadapter).[`get`](#get-2)

##### has()

> **has**(`key`): `Promise`\<`boolean`\>

Defined in: [chat/storage.ts:221](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L221)

Check whether a key exists.

###### Parameters

###### key

`string`

Unique identifier

###### Returns

`Promise`\<`boolean`\>

`true` if key exists

###### Implementation of

[`IStorageAdapter`](#istorageadapter).[`has`](#has-2)

##### list()

> **list**(`options?`): `Promise`\<`T`[]\>

Defined in: [chat/storage.ts:168](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L168)

List items with optional filtering, sorting, and pagination.

###### Parameters

###### options?

[`ListOptions`](#listoptions)\<`T`\>

Filter, sort, limit, offset options

###### Returns

`Promise`\<`T`[]\>

Array of matching items

###### Implementation of

[`IStorageAdapter`](#istorageadapter).[`list`](#list-2)

##### update()

> **update**(`key`, `item`): `Promise`\<`void`\>

Defined in: [chat/storage.ts:199](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L199)

Update an existing item. Throws `StorageError` with code `NOT_FOUND` if key missing.

###### Parameters

###### key

`string`

Unique identifier

###### item

`T`

Updated data

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IStorageAdapter`](#istorageadapter).[`update`](#update-2)

***

### StorageError

Defined in: [chat/storage.ts:31](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L31)

Error thrown by storage operations.

#### Example

```typescript
try {
  await store.get("missing-id");
} catch (e) {
  if (e instanceof StorageError && e.code === ErrorCode.STORAGE_NOT_FOUND) {
    // handle missing item
  }
}
```

#### Extends

- [`AgentSDKError`](/api-reference/core/#agentsdkerror)

#### Constructors

##### Constructor

> **new StorageError**(`message`, `code`): [`StorageError`](#storageerror)

Defined in: [chat/storage.ts:35](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L35)

###### Parameters

###### message

`string`

###### code

[`StorageErrorCode`](#storageerrorcode-1)

###### Returns

[`StorageError`](#storageerror)

###### Overrides

[`AgentSDKError`](/api-reference/core/#agentsdkerror).[`constructor`](/api-reference/core/#constructor-2)

#### Properties

##### code

> `readonly` **code**: [`StorageErrorCode`](#storageerrorcode-1)

Defined in: [chat/storage.ts:33](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L33)

Machine-readable error code from the unified ErrorCode enum

###### Overrides

[`AgentSDKError`](/api-reference/core/#agentsdkerror).[`code`](/api-reference/core/#code-2)

##### httpStatus?

> `readonly` `optional` **httpStatus**: `number`

Defined in: [errors.ts:25](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L25)

HTTP status code hint for error classification

###### Inherited from

[`AgentSDKError`](/api-reference/core/#agentsdkerror).[`httpStatus`](/api-reference/core/#httpstatus-2)

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [errors.ts:23](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L23)

Whether this error is safe to retry

###### Inherited from

[`AgentSDKError`](/api-reference/core/#agentsdkerror).[`retryable`](/api-reference/core/#retryable-2)

#### Methods

##### is()

> `static` **is**(`error`): `error is AgentSDKError`

Defined in: [errors.ts:36](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/errors.ts#L36)

Check if an error is an AgentSDKError (works across bundled copies)

###### Parameters

###### error

`unknown`

###### Returns

`error is AgentSDKError`

###### Inherited from

[`AgentSDKError`](/api-reference/core/#agentsdkerror).[`is`](/api-reference/core/#is-2)

## Interfaces

### FileStorageOptions

Defined in: [chat/storage.ts:241](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L241)

Options for configuring `FileStorage`.

#### Properties

##### directory

> **directory**: `string`

Defined in: [chat/storage.ts:243](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L243)

Directory path where JSON files are stored

##### extension?

> `optional` **extension**: `string`

Defined in: [chat/storage.ts:245](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L245)

File extension (default: `.json`)

***

### IStorageAdapter

Defined in: [chat/storage.ts:80](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L80)

Generic storage adapter for CRUD operations on any data type.
Items are identified by a string key.

#### Example

```typescript
const store: IStorageAdapter<{ name: string }> = new InMemoryStorage();
await store.create("key1", { name: "Alice" });
const item = await store.get("key1"); // { name: "Alice" }
```

#### Type Parameters

##### T

`T`

The type of stored items

#### Methods

##### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [chat/storage.ts:131](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L131)

Remove all items from storage.

###### Returns

`Promise`\<`void`\>

##### count()

> **count**(): `Promise`\<`number`\>

Defined in: [chat/storage.ts:126](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L126)

Return the number of stored items.

###### Returns

`Promise`\<`number`\>

Count of items

##### create()

> **create**(`key`, `item`): `Promise`\<`void`\>

Defined in: [chat/storage.ts:100](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L100)

Create a new item. Throws `StorageError` with code `DUPLICATE_KEY` if key exists.

###### Parameters

###### key

`string`

Unique identifier

###### item

`T`

Data to store

###### Returns

`Promise`\<`void`\>

##### delete()

> **delete**(`key`): `Promise`\<`void`\>

Defined in: [chat/storage.ts:113](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L113)

Delete an item by key. Throws `StorageError` with code `NOT_FOUND` if key missing.

###### Parameters

###### key

`string`

Unique identifier

###### Returns

`Promise`\<`void`\>

##### dispose()?

> `optional` **dispose**(): `Promise`\<`void`\>

Defined in: [chat/storage.ts:137](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L137)

Release any resources held by this adapter (DB connections, file handles).
Optional — adapters that don't hold resources need not implement this.

###### Returns

`Promise`\<`void`\>

##### get()

> **get**(`key`): `Promise`\<`T` \| `null`\>

Defined in: [chat/storage.ts:86](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L86)

Retrieve an item by key.

###### Parameters

###### key

`string`

Unique identifier

###### Returns

`Promise`\<`T` \| `null`\>

The item, or `null` if not found

##### has()

> **has**(`key`): `Promise`\<`boolean`\>

Defined in: [chat/storage.ts:120](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L120)

Check whether a key exists.

###### Parameters

###### key

`string`

Unique identifier

###### Returns

`Promise`\<`boolean`\>

`true` if key exists

##### list()

> **list**(`options?`): `Promise`\<`T`[]\>

Defined in: [chat/storage.ts:93](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L93)

List items with optional filtering, sorting, and pagination.

###### Parameters

###### options?

[`ListOptions`](#listoptions)\<`T`\>

Filter, sort, limit, offset options

###### Returns

`Promise`\<`T`[]\>

Array of matching items

##### update()

> **update**(`key`, `item`): `Promise`\<`void`\>

Defined in: [chat/storage.ts:107](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L107)

Update an existing item. Throws `StorageError` with code `NOT_FOUND` if key missing.

###### Parameters

###### key

`string`

Unique identifier

###### item

`T`

Updated data

###### Returns

`Promise`\<`void`\>

***

### ListOptions

Defined in: [chat/storage.ts:56](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L56)

Options for listing stored items.

#### Type Parameters

##### T

`T`

The type of stored items

#### Properties

##### filter()?

> `optional` **filter**: (`item`) => `boolean`

Defined in: [chat/storage.ts:58](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L58)

Filter predicate — return `true` to include the item

###### Parameters

###### item

`T`

###### Returns

`boolean`

##### limit?

> `optional` **limit**: `number`

Defined in: [chat/storage.ts:62](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L62)

Maximum number of items to return

##### offset?

> `optional` **offset**: `number`

Defined in: [chat/storage.ts:64](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L64)

Number of items to skip (for pagination)

##### sort()?

> `optional` **sort**: (`a`, `b`) => `number`

Defined in: [chat/storage.ts:60](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L60)

Sort comparator — standard Array.sort semantics

###### Parameters

###### a

`T`

###### b

`T`

###### Returns

`number`

## Type Aliases

### StorageErrorCode

> **StorageErrorCode** = [`STORAGE_NOT_FOUND`](/api-reference/core/#storage_not_found) \| [`STORAGE_DUPLICATE_KEY`](/api-reference/core/#storage_duplicate_key) \| [`STORAGE_IO_ERROR`](/api-reference/core/#storage_io_error) \| [`STORAGE_SERIALIZATION_ERROR`](/api-reference/core/#storage_serialization_error)

Defined in: [chat/storage.ts:43](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/storage.ts#L43)

Storage-specific subset of ErrorCode

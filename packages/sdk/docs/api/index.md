[**@witqq/agent-sdk**](README.md)

***

[@witqq/agent-sdk](README.md) / index

# index

## Enumerations

### ErrorCode

Defined in: [types/errors.ts:4](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L4)

Unified error codes for all SDK errors — single source of truth.

#### Enumeration Members

##### ABORTED

> **ABORTED**: `"ABORTED"`

Defined in: [types/errors.ts:29](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L29)

##### AUTH\_EXPIRED

> **AUTH\_EXPIRED**: `"AUTH_EXPIRED"`

Defined in: [types/errors.ts:6](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L6)

##### AUTH\_INVALID

> **AUTH\_INVALID**: `"AUTH_INVALID"`

Defined in: [types/errors.ts:7](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L7)

##### AUTH\_REQUIRED

> **AUTH\_REQUIRED**: `"AUTH_REQUIRED"`

Defined in: [types/errors.ts:44](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L44)

##### BACKEND\_NOT\_INSTALLED

> **BACKEND\_NOT\_INSTALLED**: `"BACKEND_NOT_INSTALLED"`

Defined in: [types/errors.ts:32](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L32)

##### CONTEXT\_OVERFLOW

> **CONTEXT\_OVERFLOW**: `"CONTEXT_OVERFLOW"`

Defined in: [types/errors.ts:20](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L20)

##### DEPENDENCY\_MISSING

> **DEPENDENCY\_MISSING**: `"DEPENDENCY_MISSING"`

Defined in: [types/errors.ts:31](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L31)

##### DISPOSED

> **DISPOSED**: `"DISPOSED"`

Defined in: [types/errors.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L28)

##### INVALID\_INPUT

> **INVALID\_INPUT**: `"INVALID_INPUT"`

Defined in: [types/errors.ts:23](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L23)

##### INVALID\_RESPONSE

> **INVALID\_RESPONSE**: `"INVALID_RESPONSE"`

Defined in: [types/errors.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L24)

##### INVALID\_TRANSITION

> **INVALID\_TRANSITION**: `"INVALID_TRANSITION"`

Defined in: [types/errors.ts:30](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L30)

##### MODEL\_NOT\_FOUND

> **MODEL\_NOT\_FOUND**: `"MODEL_NOT_FOUND"`

Defined in: [types/errors.ts:18](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L18)

##### MODEL\_OVERLOADED

> **MODEL\_OVERLOADED**: `"MODEL_OVERLOADED"`

Defined in: [types/errors.ts:19](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L19)

##### NETWORK

> **NETWORK**: `"NETWORK"`

Defined in: [types/errors.ts:13](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L13)

##### PERMISSION\_DENIED

> **PERMISSION\_DENIED**: `"PERMISSION_DENIED"`

Defined in: [types/errors.ts:36](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L36)

##### PROVIDER\_ERROR

> **PROVIDER\_ERROR**: `"PROVIDER_ERROR"`

Defined in: [types/errors.ts:17](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L17)

##### PROVIDER\_NOT\_FOUND

> **PROVIDER\_NOT\_FOUND**: `"PROVIDER_NOT_FOUND"`

Defined in: [types/errors.ts:43](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L43)

##### RATE\_LIMIT

> **RATE\_LIMIT**: `"RATE_LIMIT"`

Defined in: [types/errors.ts:10](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L10)

##### REENTRANCY

> **REENTRANCY**: `"REENTRANCY"`

Defined in: [types/errors.ts:27](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L27)

##### SESSION\_EXPIRED

> **SESSION\_EXPIRED**: `"SESSION_EXPIRED"`

Defined in: [types/errors.ts:40](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L40)

##### SESSION\_NOT\_FOUND

> **SESSION\_NOT\_FOUND**: `"SESSION_NOT_FOUND"`

Defined in: [types/errors.ts:39](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L39)

##### STORAGE\_DUPLICATE\_KEY

> **STORAGE\_DUPLICATE\_KEY**: `"STORAGE_DUPLICATE_KEY"`

Defined in: [types/errors.ts:50](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L50)

##### STORAGE\_ERROR

> **STORAGE\_ERROR**: `"STORAGE_ERROR"`

Defined in: [types/errors.ts:47](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L47)

##### STORAGE\_IO\_ERROR

> **STORAGE\_IO\_ERROR**: `"STORAGE_IO_ERROR"`

Defined in: [types/errors.ts:51](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L51)

##### STORAGE\_NOT\_FOUND

> **STORAGE\_NOT\_FOUND**: `"STORAGE_NOT_FOUND"`

Defined in: [types/errors.ts:49](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L49)

##### STORAGE\_SERIALIZATION\_ERROR

> **STORAGE\_SERIALIZATION\_ERROR**: `"STORAGE_SERIALIZATION_ERROR"`

Defined in: [types/errors.ts:52](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L52)

##### TIMEOUT

> **TIMEOUT**: `"TIMEOUT"`

Defined in: [types/errors.ts:14](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L14)

##### TOOL\_EXECUTION

> **TOOL\_EXECUTION**: `"TOOL_EXECUTION"`

Defined in: [types/errors.ts:35](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L35)

## Classes

### AbortError

Defined in: [errors.ts:133](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L133)

Thrown when an agent run is aborted

#### Extends

- [`AgentSDKError`](#agentsdkerror)

#### Constructors

##### Constructor

> **new AbortError**(): [`AbortError`](#aborterror)

Defined in: [errors.ts:134](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L134)

###### Returns

[`AbortError`](#aborterror)

###### Overrides

[`AgentSDKError`](#agentsdkerror).[`constructor`](#constructor-2)

#### Properties

##### code?

> `readonly` `optional` **code?**: `string`

Defined in: [errors.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L24)

Machine-readable error code. Prefer values from the ErrorCode enum.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`code`](#code-2)

##### httpStatus?

> `readonly` `optional` **httpStatus?**: `number`

Defined in: [errors.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L28)

HTTP status code hint for error classification

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`httpStatus`](#httpstatus-2)

##### providerRequestSent?

> `readonly` `optional` **providerRequestSent?**: `boolean`

Defined in: [errors.ts:30](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L30)

Undefined means provider effect is unknown; false is explicit unsent evidence.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`providerRequestSent`](#providerrequestsent-2)

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [errors.ts:26](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L26)

Whether this error is safe to retry

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`retryable`](#retryable-2)

#### Methods

##### is()

> `static` **is**(`error`): `error is AgentSDKError`

Defined in: [errors.ts:42](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L42)

Check if an error is an AgentSDKError (works across bundled copies)

###### Parameters

###### error

`unknown`

###### Returns

`error is AgentSDKError`

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`is`](#is-2)

***

### ActivityTimeoutError

Defined in: [errors.ts:152](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L152)

Thrown when a stream has no activity within the configured timeout

#### Extends

- [`AgentSDKError`](#agentsdkerror)

#### Constructors

##### Constructor

> **new ActivityTimeoutError**(`timeoutMs`): [`ActivityTimeoutError`](#activitytimeouterror)

Defined in: [errors.ts:153](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L153)

###### Parameters

###### timeoutMs

`number`

###### Returns

[`ActivityTimeoutError`](#activitytimeouterror)

###### Overrides

[`AgentSDKError`](#agentsdkerror).[`constructor`](#constructor-2)

#### Properties

##### code?

> `readonly` `optional` **code?**: `string`

Defined in: [errors.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L24)

Machine-readable error code. Prefer values from the ErrorCode enum.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`code`](#code-2)

##### httpStatus?

> `readonly` `optional` **httpStatus?**: `number`

Defined in: [errors.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L28)

HTTP status code hint for error classification

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`httpStatus`](#httpstatus-2)

##### providerRequestSent?

> `readonly` `optional` **providerRequestSent?**: `boolean`

Defined in: [errors.ts:30](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L30)

Undefined means provider effect is unknown; false is explicit unsent evidence.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`providerRequestSent`](#providerrequestsent-2)

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [errors.ts:26](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L26)

Whether this error is safe to retry

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`retryable`](#retryable-2)

#### Methods

##### is()

> `static` **is**(`error`): `error is AgentSDKError`

Defined in: [errors.ts:42](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L42)

Check if an error is an AgentSDKError (works across bundled copies)

###### Parameters

###### error

`unknown`

###### Returns

`error is AgentSDKError`

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`is`](#is-2)

***

### AgentSDKError

Defined in: [errors.ts:20](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L20)

Base error class for agent-sdk.

Use `AgentSDKError.is(err)` for reliable cross-module `instanceof` checks
(works across separately bundled entry points where `instanceof` may fail).

#### Extends

- `Error`

#### Extended by

- [`StorageError`](chat/storage.md#storageerror)
- [`ChatError`](chat/errors.md#chaterror)
- [`ProviderAcknowledgmentError`](#provideracknowledgmenterror)
- [`ReentrancyError`](#reentrancyerror)
- [`DisposedError`](#disposederror)
- [`BackendNotFoundError`](#backendnotfounderror)
- [`BackendAlreadyRegisteredError`](#backendalreadyregisterederror)
- [`SubprocessError`](#subprocesserror)
- [`DependencyError`](#dependencyerror)
- [`AbortError`](#aborterror)
- [`ToolExecutionError`](#toolexecutionerror)
- [`ActivityTimeoutError`](#activitytimeouterror)
- [`StructuredOutputError`](#structuredoutputerror)
- [`AuthError`](auth.md#autherror)

#### Constructors

##### Constructor

> **new AgentSDKError**(`message`, `options?`): [`AgentSDKError`](#agentsdkerror)

Defined in: [errors.ts:32](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L32)

###### Parameters

###### message

`string`

###### options?

[`AgentSDKErrorOptions`](#agentsdkerroroptions)

###### Returns

[`AgentSDKError`](#agentsdkerror)

###### Overrides

`Error.constructor`

#### Properties

##### code?

> `readonly` `optional` **code?**: `string`

Defined in: [errors.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L24)

Machine-readable error code. Prefer values from the ErrorCode enum.

##### httpStatus?

> `readonly` `optional` **httpStatus?**: `number`

Defined in: [errors.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L28)

HTTP status code hint for error classification

##### providerRequestSent?

> `readonly` `optional` **providerRequestSent?**: `boolean`

Defined in: [errors.ts:30](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L30)

Undefined means provider effect is unknown; false is explicit unsent evidence.

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [errors.ts:26](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L26)

Whether this error is safe to retry

#### Methods

##### is()

> `static` **is**(`error`): `error is AgentSDKError`

Defined in: [errors.ts:42](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L42)

Check if an error is an AgentSDKError (works across bundled copies)

###### Parameters

###### error

`unknown`

###### Returns

`error is AgentSDKError`

***

### BackendAlreadyRegisteredError

Defined in: [errors.ts:104](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L104)

Thrown when a backend is already registered

#### Extends

- [`AgentSDKError`](#agentsdkerror)

#### Constructors

##### Constructor

> **new BackendAlreadyRegisteredError**(`backend`): [`BackendAlreadyRegisteredError`](#backendalreadyregisterederror)

Defined in: [errors.ts:105](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L105)

###### Parameters

###### backend

`string`

###### Returns

[`BackendAlreadyRegisteredError`](#backendalreadyregisterederror)

###### Overrides

[`AgentSDKError`](#agentsdkerror).[`constructor`](#constructor-2)

#### Properties

##### code?

> `readonly` `optional` **code?**: `string`

Defined in: [errors.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L24)

Machine-readable error code. Prefer values from the ErrorCode enum.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`code`](#code-2)

##### httpStatus?

> `readonly` `optional` **httpStatus?**: `number`

Defined in: [errors.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L28)

HTTP status code hint for error classification

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`httpStatus`](#httpstatus-2)

##### providerRequestSent?

> `readonly` `optional` **providerRequestSent?**: `boolean`

Defined in: [errors.ts:30](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L30)

Undefined means provider effect is unknown; false is explicit unsent evidence.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`providerRequestSent`](#providerrequestsent-2)

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [errors.ts:26](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L26)

Whether this error is safe to retry

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`retryable`](#retryable-2)

#### Methods

##### is()

> `static` **is**(`error`): `error is AgentSDKError`

Defined in: [errors.ts:42](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L42)

Check if an error is an AgentSDKError (works across bundled copies)

###### Parameters

###### error

`unknown`

###### Returns

`error is AgentSDKError`

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`is`](#is-2)

***

### BackendNotFoundError

Defined in: [errors.ts:91](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L91)

Thrown when a backend is not found in the registry

#### Extends

- [`AgentSDKError`](#agentsdkerror)

#### Constructors

##### Constructor

> **new BackendNotFoundError**(`backend`): [`BackendNotFoundError`](#backendnotfounderror)

Defined in: [errors.ts:92](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L92)

###### Parameters

###### backend

`string`

###### Returns

[`BackendNotFoundError`](#backendnotfounderror)

###### Overrides

[`AgentSDKError`](#agentsdkerror).[`constructor`](#constructor-2)

#### Properties

##### code?

> `readonly` `optional` **code?**: `string`

Defined in: [errors.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L24)

Machine-readable error code. Prefer values from the ErrorCode enum.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`code`](#code-2)

##### httpStatus?

> `readonly` `optional` **httpStatus?**: `number`

Defined in: [errors.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L28)

HTTP status code hint for error classification

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`httpStatus`](#httpstatus-2)

##### providerRequestSent?

> `readonly` `optional` **providerRequestSent?**: `boolean`

Defined in: [errors.ts:30](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L30)

Undefined means provider effect is unknown; false is explicit unsent evidence.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`providerRequestSent`](#providerrequestsent-2)

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [errors.ts:26](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L26)

Whether this error is safe to retry

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`retryable`](#retryable-2)

#### Methods

##### is()

> `static` **is**(`error`): `error is AgentSDKError`

Defined in: [errors.ts:42](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L42)

Check if an error is an AgentSDKError (works across bundled copies)

###### Parameters

###### error

`unknown`

###### Returns

`error is AgentSDKError`

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`is`](#is-2)

***

### `abstract` BaseAgent

Defined in: [base-agent.ts:23](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L23)

Abstract base agent with shared lifecycle logic.
 Concrete backends extend this and implement the protected _run/_stream methods.

#### Implements

- [`IAgent`](#iagent)

#### Constructors

##### Constructor

> **new BaseAgent**(`config`): [`BaseAgent`](#abstract-baseagent)

Defined in: [base-agent.ts:38](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L38)

###### Parameters

###### config

[`FullAgentConfig`](#fullagentconfig)

###### Returns

[`BaseAgent`](#abstract-baseagent)

#### Properties

##### abortController

> `protected` **abortController**: `AbortController` \| `null` = `null`

Defined in: [base-agent.ts:25](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L25)

##### backendName

> `abstract` `protected` `readonly` **backendName**: `string`

Defined in: [base-agent.ts:31](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L31)

Backend identifier (e.g. "copilot", "claude", "vercel-ai")

##### config

> `protected` `readonly` **config**: [`FullAgentConfig`](#fullagentconfig)

Defined in: [base-agent.ts:26](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L26)

##### state

> `protected` **state**: [`AgentState`](#agentstate) = `"idle"`

Defined in: [base-agent.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L24)

#### Accessors

##### sessionId

###### Get Signature

> **get** **sessionId**(): `string` \| `undefined`

Defined in: [base-agent.ts:34](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L34)

CLI session ID for persistent mode. Override in backends that support it.

###### Returns

`string` \| `undefined`

The CLI session ID when using persistent session mode. Undefined in per-call mode
 or before the first call. Can be stored externally for session resume.

###### Implementation of

[`IAgent`](#iagent).[`sessionId`](#sessionid-1)

#### Methods

##### abort()

> **abort**(): `void`

Defined in: [base-agent.ts:184](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L184)

Abort the current operation. No-op if not running.

###### Returns

`void`

###### Implementation of

[`IAgent`](#iagent).[`abort`](#abort-1)

##### addStreamMiddleware()

> **addStreamMiddleware**(`middleware`): `void`

Defined in: [base-agent.ts:152](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L152)

Register a stream middleware. Applied in registration order after built-in transforms.

###### Parameters

###### middleware

[`StreamMiddleware`](#streammiddleware)

###### Returns

`void`

##### checkAbort()

> `protected` **checkAbort**(`signal`): `void`

Defined in: [base-agent.ts:508](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L508)

Throw AbortError if signal is already aborted

###### Parameters

###### signal

`AbortSignal`

###### Returns

`void`

##### dispose()

> **dispose**(): `void`

Defined in: [base-agent.ts:204](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L204)

Mark agent as disposed. Override to add cleanup.

###### Returns

`void`

###### Implementation of

[`IAgent`](#iagent).[`dispose`](#dispose-3)

##### executeRun()

> `abstract` `protected` **executeRun**(`messages`, `options`, `signal`): `Promise`\<[`AgentResult`](#agentresult)\<`void`\>\>

Defined in: [base-agent.ts:214](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L214)

Execute a blocking run. Backend implements the actual LLM call.

###### Parameters

###### messages

[`Message`](#message)[]

###### options

[`RunOptions`](#runoptions)

###### signal

`AbortSignal`

###### Returns

`Promise`\<[`AgentResult`](#agentresult)\<`void`\>\>

##### executeRunStructured()

> `abstract` `protected` **executeRunStructured**\<`T`\>(`messages`, `schema`, `options`, `signal`): `Promise`\<[`AgentResult`](#agentresult)\<`T`\>\>

Defined in: [base-agent.ts:221](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L221)

Execute a structured output run. Backend implements parsing.

###### Type Parameters

###### T

`T`

###### Parameters

###### messages

[`Message`](#message)[]

###### schema

[`StructuredOutputConfig`](#structuredoutputconfig)\<`T`\>

###### options

[`RunOptions`](#runoptions)

###### signal

`AbortSignal`

###### Returns

`Promise`\<[`AgentResult`](#agentresult)\<`T`\>\>

##### executeStream()

> `abstract` `protected` **executeStream**(`messages`, `options`, `signal`): `AsyncIterable`\<[`AgentEvent`](#agentevent)\>

Defined in: [base-agent.ts:229](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L229)

Execute a streaming run. Backend yields events.

###### Parameters

###### messages

[`Message`](#message)[]

###### options

[`RunOptions`](#runoptions)

###### signal

`AbortSignal`

###### Returns

`AsyncIterable`\<[`AgentEvent`](#agentevent)\>

##### getConfig()

> **getConfig**(): `Readonly`\<[`FullAgentConfig`](#fullagentconfig)\>

Defined in: [base-agent.ts:199](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L199)

Get frozen agent configuration.

###### Returns

`Readonly`\<[`FullAgentConfig`](#fullagentconfig)\>

###### Implementation of

[`IAgent`](#iagent).[`getConfig`](#getconfig-1)

##### getState()

> **getState**(): [`AgentState`](#agentstate)

Defined in: [base-agent.ts:195](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L195)

Get current agent lifecycle state.

###### Returns

[`AgentState`](#agentstate)

###### Implementation of

[`IAgent`](#iagent).[`getState`](#getstate-1)

##### guardDisposed()

> `protected` **guardDisposed**(): `void`

Defined in: [base-agent.ts:501](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L501)

###### Returns

`void`

##### guardReentrancy()

> `protected` **guardReentrancy**(): `void`

Defined in: [base-agent.ts:495](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L495)

###### Returns

`void`

##### interrupt()

> **interrupt**(): `Promise`\<`void`\>

Defined in: [base-agent.ts:191](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L191)

Default interrupt — falls back to abort(). Backends may override with graceful shutdown.

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IAgent`](#iagent).[`interrupt`](#interrupt-1)

##### resolveTools()

> `protected` **resolveTools**(`options?`): [`ToolDefinition`](#tooldefinition)\<`unknown`\>[]

Defined in: [base-agent.ts:339](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L339)

Resolve tools to use for this call (per-call override > config default)

###### Parameters

###### options?

[`RunOptions`](#runoptions)

###### Returns

[`ToolDefinition`](#tooldefinition)\<`unknown`\>[]

##### run()

> **run**(`prompt`, `options`): `Promise`\<[`AgentResult`](#agentresult)\<`void`\>\>

Defined in: [base-agent.ts:44](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L44)

Run a single prompt and return the result. Wraps prompt in a user message.

###### Parameters

###### prompt

[`MessageContent`](#messagecontent)

###### options

[`RunOptions`](#runoptions)

###### Returns

`Promise`\<[`AgentResult`](#agentresult)\<`void`\>\>

###### Implementation of

[`IAgent`](#iagent).[`run`](#run-1)

##### runStructured()

> **runStructured**\<`T`\>(`prompt`, `schema`, `options`): `Promise`\<[`AgentResult`](#agentresult)\<`T`\>\>

Defined in: [base-agent.ts:87](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L87)

Run with structured output validated against a Zod schema.

###### Type Parameters

###### T

`T`

###### Parameters

###### prompt

[`MessageContent`](#messagecontent)

###### schema

[`StructuredOutputConfig`](#structuredoutputconfig)\<`T`\>

###### options

[`RunOptions`](#runoptions)

###### Returns

`Promise`\<[`AgentResult`](#agentresult)\<`T`\>\>

###### Implementation of

[`IAgent`](#iagent).[`runStructured`](#runstructured-1)

##### runWithContext()

> **runWithContext**(`messages`, `options`): `Promise`\<[`AgentResult`](#agentresult)\<`void`\>\>

Defined in: [base-agent.ts:66](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L66)

Run with full conversation history. Messages are passed directly to the backend.

###### Parameters

###### messages

[`Message`](#message)[]

###### options

[`RunOptions`](#runoptions)

###### Returns

`Promise`\<[`AgentResult`](#agentresult)\<`void`\>\>

###### Implementation of

[`IAgent`](#iagent).[`runWithContext`](#runwithcontext-1)

##### stream()

> **stream**(`prompt`, `options`): `AsyncIterable`\<[`AgentEvent`](#agentevent)\>

Defined in: [base-agent.ts:110](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L110)

Stream events for a single prompt. Wraps prompt in a user message.

###### Parameters

###### prompt

[`MessageContent`](#messagecontent)

###### options

[`RunOptions`](#runoptions)

###### Returns

`AsyncIterable`\<[`AgentEvent`](#agentevent)\>

###### Implementation of

[`IAgent`](#iagent).[`stream`](#stream-1)

##### streamWithContext()

> **streamWithContext**(`messages`, `options`): `AsyncIterable`\<[`AgentEvent`](#agentevent)\>

Defined in: [base-agent.ts:131](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/base-agent.ts#L131)

Stream events with full conversation history. Messages are passed directly to the backend.

###### Parameters

###### messages

[`Message`](#message)[]

###### options

[`RunOptions`](#runoptions)

###### Returns

`AsyncIterable`\<[`AgentEvent`](#agentevent)\>

###### Implementation of

[`IAgent`](#iagent).[`streamWithContext`](#streamwithcontext-1)

***

### CompositePermissionStore

Defined in: [permission-store.ts:128](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L128)

Composes multiple stores — checks in order, routes writes by scope.

- "session" → sessionStore (in-memory)
- "project" → projectStore (file-based in project directory)
- "always"  → userStore (file-based in user home)

#### Implements

- [`IPermissionStore`](#ipermissionstore)

#### Constructors

##### Constructor

> **new CompositePermissionStore**(`sessionStore`, `projectStore`, `userStore?`): [`CompositePermissionStore`](#compositepermissionstore)

Defined in: [permission-store.ts:133](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L133)

###### Parameters

###### sessionStore

[`IPermissionStore`](#ipermissionstore)

###### projectStore

[`IPermissionStore`](#ipermissionstore)

###### userStore?

[`IPermissionStore`](#ipermissionstore)

###### Returns

[`CompositePermissionStore`](#compositepermissionstore)

#### Methods

##### approve()

> **approve**(`toolName`, `scope`): `Promise`\<`void`\>

Defined in: [permission-store.ts:151](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L151)

Store an approval decision

###### Parameters

###### toolName

`string`

###### scope

[`PermissionScope`](#permissionscope)

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IPermissionStore`](#ipermissionstore).[`approve`](#approve-3)

##### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [permission-store.ts:169](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L169)

Clear all approvals

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IPermissionStore`](#ipermissionstore).[`clear`](#clear-3)

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [permission-store.ts:175](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L175)

Dispose resources

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IPermissionStore`](#ipermissionstore).[`dispose`](#dispose-6)

##### isApproved()

> **isApproved**(`toolName`): `Promise`\<`boolean`\>

Defined in: [permission-store.ts:143](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L143)

Check if tool is already approved

###### Parameters

###### toolName

`string`

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`IPermissionStore`](#ipermissionstore).[`isApproved`](#isapproved-3)

##### revoke()

> **revoke**(`toolName`): `Promise`\<`void`\>

Defined in: [permission-store.ts:163](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L163)

Revoke approval for a tool

###### Parameters

###### toolName

`string`

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IPermissionStore`](#ipermissionstore).[`revoke`](#revoke-3)

***

### DependencyError

Defined in: [errors.ts:120](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L120)

Thrown when a required peer dependency is not installed

#### Extends

- [`AgentSDKError`](#agentsdkerror)

#### Constructors

##### Constructor

> **new DependencyError**(`packageName`): [`DependencyError`](#dependencyerror)

Defined in: [errors.ts:123](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L123)

###### Parameters

###### packageName

`string`

###### Returns

[`DependencyError`](#dependencyerror)

###### Overrides

[`AgentSDKError`](#agentsdkerror).[`constructor`](#constructor-2)

#### Properties

##### code?

> `readonly` `optional` **code?**: `string`

Defined in: [errors.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L24)

Machine-readable error code. Prefer values from the ErrorCode enum.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`code`](#code-2)

##### httpStatus?

> `readonly` `optional` **httpStatus?**: `number`

Defined in: [errors.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L28)

HTTP status code hint for error classification

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`httpStatus`](#httpstatus-2)

##### packageName

> `readonly` **packageName**: `string`

Defined in: [errors.ts:121](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L121)

##### providerRequestSent?

> `readonly` `optional` **providerRequestSent?**: `boolean`

Defined in: [errors.ts:30](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L30)

Undefined means provider effect is unknown; false is explicit unsent evidence.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`providerRequestSent`](#providerrequestsent-2)

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [errors.ts:26](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L26)

Whether this error is safe to retry

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`retryable`](#retryable-2)

#### Methods

##### is()

> `static` **is**(`error`): `error is AgentSDKError`

Defined in: [errors.ts:42](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L42)

Check if an error is an AgentSDKError (works across bundled copies)

###### Parameters

###### error

`unknown`

###### Returns

`error is AgentSDKError`

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`is`](#is-2)

***

### DisposedError

Defined in: [errors.ts:81](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L81)

Thrown when an operation is attempted on a disposed agent/service

#### Extends

- [`AgentSDKError`](#agentsdkerror)

#### Constructors

##### Constructor

> **new DisposedError**(`entity`): [`DisposedError`](#disposederror)

Defined in: [errors.ts:82](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L82)

###### Parameters

###### entity

`string`

###### Returns

[`DisposedError`](#disposederror)

###### Overrides

[`AgentSDKError`](#agentsdkerror).[`constructor`](#constructor-2)

#### Properties

##### code?

> `readonly` `optional` **code?**: `string`

Defined in: [errors.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L24)

Machine-readable error code. Prefer values from the ErrorCode enum.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`code`](#code-2)

##### httpStatus?

> `readonly` `optional` **httpStatus?**: `number`

Defined in: [errors.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L28)

HTTP status code hint for error classification

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`httpStatus`](#httpstatus-2)

##### providerRequestSent?

> `readonly` `optional` **providerRequestSent?**: `boolean`

Defined in: [errors.ts:30](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L30)

Undefined means provider effect is unknown; false is explicit unsent evidence.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`providerRequestSent`](#providerrequestsent-2)

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [errors.ts:26](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L26)

Whether this error is safe to retry

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`retryable`](#retryable-2)

#### Methods

##### is()

> `static` **is**(`error`): `error is AgentSDKError`

Defined in: [errors.ts:42](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L42)

Check if an error is an AgentSDKError (works across bundled copies)

###### Parameters

###### error

`unknown`

###### Returns

`error is AgentSDKError`

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`is`](#is-2)

***

### FilePermissionStore

Defined in: [permission-store.ts:66](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L66)

File-backed store — reads/writes a JSON file for persistent approvals.

#### Implements

- [`IPermissionStore`](#ipermissionstore)

#### Constructors

##### Constructor

> **new FilePermissionStore**(`filePath`): [`FilePermissionStore`](#filepermissionstore)

Defined in: [permission-store.ts:69](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L69)

###### Parameters

###### filePath

`string`

###### Returns

[`FilePermissionStore`](#filepermissionstore)

#### Methods

##### approve()

> **approve**(`toolName`, `scope`): `Promise`\<`void`\>

Defined in: [permission-store.ts:78](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L78)

Store an approval decision

###### Parameters

###### toolName

`string`

###### scope

[`PermissionScope`](#permissionscope)

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IPermissionStore`](#ipermissionstore).[`approve`](#approve-3)

##### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [permission-store.ts:91](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L91)

Clear all approvals

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IPermissionStore`](#ipermissionstore).[`clear`](#clear-3)

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [permission-store.ts:95](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L95)

Dispose resources

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IPermissionStore`](#ipermissionstore).[`dispose`](#dispose-6)

##### isApproved()

> **isApproved**(`toolName`): `Promise`\<`boolean`\>

Defined in: [permission-store.ts:73](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L73)

Check if tool is already approved

###### Parameters

###### toolName

`string`

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`IPermissionStore`](#ipermissionstore).[`isApproved`](#isapproved-3)

##### revoke()

> **revoke**(`toolName`): `Promise`\<`void`\>

Defined in: [permission-store.ts:85](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L85)

Revoke approval for a tool

###### Parameters

###### toolName

`string`

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IPermissionStore`](#ipermissionstore).[`revoke`](#revoke-3)

***

### InMemoryPermissionStore

Defined in: [permission-store.ts:29](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L29)

In-memory store — approvals live until process exits (or dispose).

#### Implements

- [`IPermissionStore`](#ipermissionstore)

#### Constructors

##### Constructor

> **new InMemoryPermissionStore**(): [`InMemoryPermissionStore`](#inmemorypermissionstore)

###### Returns

[`InMemoryPermissionStore`](#inmemorypermissionstore)

#### Methods

##### approve()

> **approve**(`toolName`, `scope`): `Promise`\<`void`\>

Defined in: [permission-store.ts:36](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L36)

Store an approval decision

###### Parameters

###### toolName

`string`

###### scope

[`PermissionScope`](#permissionscope)

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IPermissionStore`](#ipermissionstore).[`approve`](#approve-3)

##### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [permission-store.ts:45](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L45)

Clear all approvals

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IPermissionStore`](#ipermissionstore).[`clear`](#clear-3)

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [permission-store.ts:49](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L49)

Dispose resources

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IPermissionStore`](#ipermissionstore).[`dispose`](#dispose-6)

##### isApproved()

> **isApproved**(`toolName`): `Promise`\<`boolean`\>

Defined in: [permission-store.ts:32](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L32)

Check if tool is already approved

###### Parameters

###### toolName

`string`

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`IPermissionStore`](#ipermissionstore).[`isApproved`](#isapproved-3)

##### revoke()

> **revoke**(`toolName`): `Promise`\<`void`\>

Defined in: [permission-store.ts:41](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L41)

Revoke approval for a tool

###### Parameters

###### toolName

`string`

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IPermissionStore`](#ipermissionstore).[`revoke`](#revoke-3)

***

### ProviderAcknowledgmentError

Defined in: [errors.ts:53](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L53)

Local acknowledgment failure after provider dispatch. This is neither a native
transport failure nor evidence that no inference happened. It has no retry code.

#### Extends

- [`AgentSDKError`](#agentsdkerror)

#### Constructors

##### Constructor

> **new ProviderAcknowledgmentError**(`reason`, `observation`, `cause?`): [`ProviderAcknowledgmentError`](#provideracknowledgmenterror)

Defined in: [errors.ts:56](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L56)

###### Parameters

###### reason

`"persistence_failed"` \| `"identity_conflict"`

###### observation

[`ProviderAcknowledgment`](#provideracknowledgment)

###### cause?

`unknown`

###### Returns

[`ProviderAcknowledgmentError`](#provideracknowledgmenterror)

###### Overrides

[`AgentSDKError`](#agentsdkerror).[`constructor`](#constructor-2)

#### Properties

##### \_providerAcknowledgmentError

> `readonly` **\_providerAcknowledgmentError**: `true`

Defined in: [errors.ts:54](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L54)

##### code?

> `readonly` `optional` **code?**: `string`

Defined in: [errors.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L24)

Machine-readable error code. Prefer values from the ErrorCode enum.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`code`](#code-2)

##### httpStatus?

> `readonly` `optional` **httpStatus?**: `number`

Defined in: [errors.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L28)

HTTP status code hint for error classification

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`httpStatus`](#httpstatus-2)

##### observation

> `readonly` **observation**: [`ProviderAcknowledgment`](#provideracknowledgment)

Defined in: [errors.ts:58](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L58)

##### providerRequestSent?

> `readonly` `optional` **providerRequestSent?**: `boolean`

Defined in: [errors.ts:30](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L30)

Undefined means provider effect is unknown; false is explicit unsent evidence.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`providerRequestSent`](#providerrequestsent-2)

##### reason

> `readonly` **reason**: `"persistence_failed"` \| `"identity_conflict"`

Defined in: [errors.ts:57](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L57)

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [errors.ts:26](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L26)

Whether this error is safe to retry

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`retryable`](#retryable-2)

#### Methods

##### is()

> `static` **is**(`error`): `error is ProviderAcknowledgmentError`

Defined in: [errors.ts:65](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L65)

Check if an error is an AgentSDKError (works across bundled copies)

###### Parameters

###### error

`unknown`

###### Returns

`error is ProviderAcknowledgmentError`

###### Overrides

[`AgentSDKError`](#agentsdkerror).[`is`](#is-2)

***

### ReentrancyError

Defined in: [errors.ts:71](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L71)

Thrown when agent.run() is called while already running (M8 re-entrancy guard)

#### Extends

- [`AgentSDKError`](#agentsdkerror)

#### Constructors

##### Constructor

> **new ReentrancyError**(): [`ReentrancyError`](#reentrancyerror)

Defined in: [errors.ts:72](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L72)

###### Returns

[`ReentrancyError`](#reentrancyerror)

###### Overrides

[`AgentSDKError`](#agentsdkerror).[`constructor`](#constructor-2)

#### Properties

##### code?

> `readonly` `optional` **code?**: `string`

Defined in: [errors.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L24)

Machine-readable error code. Prefer values from the ErrorCode enum.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`code`](#code-2)

##### httpStatus?

> `readonly` `optional` **httpStatus?**: `number`

Defined in: [errors.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L28)

HTTP status code hint for error classification

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`httpStatus`](#httpstatus-2)

##### providerRequestSent?

> `readonly` `optional` **providerRequestSent?**: `boolean`

Defined in: [errors.ts:30](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L30)

Undefined means provider effect is unknown; false is explicit unsent evidence.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`providerRequestSent`](#providerrequestsent-2)

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [errors.ts:26](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L26)

Whether this error is safe to retry

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`retryable`](#retryable-2)

#### Methods

##### is()

> `static` **is**(`error`): `error is AgentSDKError`

Defined in: [errors.ts:42](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L42)

Check if an error is an AgentSDKError (works across bundled copies)

###### Parameters

###### error

`unknown`

###### Returns

`error is AgentSDKError`

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`is`](#is-2)

***

### StructuredOutputError

Defined in: [errors.ts:163](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L163)

Thrown when structured output parsing fails

#### Extends

- [`AgentSDKError`](#agentsdkerror)

#### Constructors

##### Constructor

> **new StructuredOutputError**(`message`, `options?`): [`StructuredOutputError`](#structuredoutputerror)

Defined in: [errors.ts:164](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L164)

###### Parameters

###### message

`string`

###### options?

`ErrorOptions`

###### Returns

[`StructuredOutputError`](#structuredoutputerror)

###### Overrides

[`AgentSDKError`](#agentsdkerror).[`constructor`](#constructor-2)

#### Properties

##### code?

> `readonly` `optional` **code?**: `string`

Defined in: [errors.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L24)

Machine-readable error code. Prefer values from the ErrorCode enum.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`code`](#code-2)

##### httpStatus?

> `readonly` `optional` **httpStatus?**: `number`

Defined in: [errors.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L28)

HTTP status code hint for error classification

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`httpStatus`](#httpstatus-2)

##### providerRequestSent?

> `readonly` `optional` **providerRequestSent?**: `boolean`

Defined in: [errors.ts:30](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L30)

Undefined means provider effect is unknown; false is explicit unsent evidence.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`providerRequestSent`](#providerrequestsent-2)

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [errors.ts:26](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L26)

Whether this error is safe to retry

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`retryable`](#retryable-2)

#### Methods

##### is()

> `static` **is**(`error`): `error is AgentSDKError`

Defined in: [errors.ts:42](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L42)

Check if an error is an AgentSDKError (works across bundled copies)

###### Parameters

###### error

`unknown`

###### Returns

`error is AgentSDKError`

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`is`](#is-2)

***

### SubprocessError

Defined in: [errors.ts:112](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L112)

Thrown when subprocess management fails

#### Extends

- [`AgentSDKError`](#agentsdkerror)

#### Constructors

##### Constructor

> **new SubprocessError**(`message`, `options?`): [`SubprocessError`](#subprocesserror)

Defined in: [errors.ts:113](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L113)

###### Parameters

###### message

`string`

###### options?

`ErrorOptions`

###### Returns

[`SubprocessError`](#subprocesserror)

###### Overrides

[`AgentSDKError`](#agentsdkerror).[`constructor`](#constructor-2)

#### Properties

##### code?

> `readonly` `optional` **code?**: `string`

Defined in: [errors.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L24)

Machine-readable error code. Prefer values from the ErrorCode enum.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`code`](#code-2)

##### httpStatus?

> `readonly` `optional` **httpStatus?**: `number`

Defined in: [errors.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L28)

HTTP status code hint for error classification

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`httpStatus`](#httpstatus-2)

##### providerRequestSent?

> `readonly` `optional` **providerRequestSent?**: `boolean`

Defined in: [errors.ts:30](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L30)

Undefined means provider effect is unknown; false is explicit unsent evidence.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`providerRequestSent`](#providerrequestsent-2)

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [errors.ts:26](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L26)

Whether this error is safe to retry

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`retryable`](#retryable-2)

#### Methods

##### is()

> `static` **is**(`error`): `error is AgentSDKError`

Defined in: [errors.ts:42](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L42)

Check if an error is an AgentSDKError (works across bundled copies)

###### Parameters

###### error

`unknown`

###### Returns

`error is AgentSDKError`

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`is`](#is-2)

***

### ToolExecutionError

Defined in: [errors.ts:141](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L141)

Thrown when a tool execution fails

#### Extends

- [`AgentSDKError`](#agentsdkerror)

#### Constructors

##### Constructor

> **new ToolExecutionError**(`toolName`, `message`, `options?`): [`ToolExecutionError`](#toolexecutionerror)

Defined in: [errors.ts:144](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L144)

###### Parameters

###### toolName

`string`

###### message

`string`

###### options?

`ErrorOptions`

###### Returns

[`ToolExecutionError`](#toolexecutionerror)

###### Overrides

[`AgentSDKError`](#agentsdkerror).[`constructor`](#constructor-2)

#### Properties

##### code?

> `readonly` `optional` **code?**: `string`

Defined in: [errors.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L24)

Machine-readable error code. Prefer values from the ErrorCode enum.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`code`](#code-2)

##### httpStatus?

> `readonly` `optional` **httpStatus?**: `number`

Defined in: [errors.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L28)

HTTP status code hint for error classification

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`httpStatus`](#httpstatus-2)

##### providerRequestSent?

> `readonly` `optional` **providerRequestSent?**: `boolean`

Defined in: [errors.ts:30](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L30)

Undefined means provider effect is unknown; false is explicit unsent evidence.

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`providerRequestSent`](#providerrequestsent-2)

##### retryable

> `readonly` **retryable**: `boolean`

Defined in: [errors.ts:26](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L26)

Whether this error is safe to retry

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`retryable`](#retryable-2)

##### toolName

> `readonly` **toolName**: `string`

Defined in: [errors.ts:142](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L142)

#### Methods

##### is()

> `static` **is**(`error`): `error is AgentSDKError`

Defined in: [errors.ts:42](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L42)

Check if an error is an AgentSDKError (works across bundled copies)

###### Parameters

###### error

`unknown`

###### Returns

`error is AgentSDKError`

###### Inherited from

[`AgentSDKError`](#agentsdkerror).[`is`](#is-2)

## Interfaces

### AgentConfig

Defined in: [types/agent.ts:133](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L133)

Identity-only agent configuration — defines the agent's behavior, NOT per-call defaults.
 For creating an agent with model/tools defaults, use FullAgentConfig.

#### Properties

##### availableTools?

> `optional` **availableTools?**: `string`[]

Defined in: [types/agent.ts:152](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L152)

Filter for backend built-in tools (e.g. `["web_search", "web_fetch"]` for Copilot).
When set, only listed built-in tools are available. Backend-specific.

**Security note**: This is a trust boundary — it controls which backend-native tools
the AI agent can invoke. By default, backends expose ALL their built-in tools.
Set this to restrict access (e.g. prevent file system access in a web-facing agent).

##### errorHandling?

> `optional` **errorHandling?**: [`ErrorHandlingConfig`](#errorhandlingconfig)

Defined in: [types/agent.ts:138](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L138)

##### heartbeatInterval?

> `optional` **heartbeatInterval?**: `number`

Defined in: [types/agent.ts:159](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L159)

Interval in milliseconds for emitting heartbeat events during streaming.
 When set, heartbeat events are emitted to keep the stream alive during
 long tool executions. Default: off (no heartbeats).

##### maxTurns?

> `optional` **maxTurns?**: `number`

Defined in: [types/agent.ts:136](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L136)

##### onUsage?

> `optional` **onUsage?**: (`usage`) => `void`

Defined in: [types/agent.ts:155](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L155)

Callback invoked with usage data after run completion or during streaming.
 Fire-and-forget: errors are logged but not propagated.

###### Parameters

###### usage

[`UsageData`](#usagedata)

###### Returns

`void`

##### permissionStore?

> `optional` **permissionStore?**: [`IPermissionStore`](#ipermissionstore)

Defined in: [types/agent.ts:140](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L140)

Pluggable store for persisting permission scope decisions across runs

##### sessionMode?

> `optional` **sessionMode?**: `"per-call"` \| `"persistent"`

Defined in: [types/agent.ts:164](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L164)

Session reuse mode for CLI backends (Copilot, Claude).
 "per-call" (default): creates a fresh CLI session for each run/stream call.
 "persistent": reuses the same CLI session across calls, preserving conversation
 history natively in the CLI backend. Session is destroyed on agent dispose().

##### supervisor?

> `optional` **supervisor?**: [`SupervisorHooks`](#supervisorhooks)

Defined in: [types/agent.ts:135](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L135)

##### systemMessageMode?

> `optional` **systemMessageMode?**: `"replace"` \| `"append"`

Defined in: [types/agent.ts:143](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L143)

How to apply systemPrompt: "append" adds to backend default, "replace" overrides it.
 Default: "append". Currently used by the Copilot backend.

##### systemPrompt

> **systemPrompt**: `string`

Defined in: [types/agent.ts:134](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L134)

##### timeout?

> `optional` **timeout?**: [`TimeoutConfig`](#timeoutconfig)

Defined in: [types/agent.ts:137](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L137)

***

### AgentResult

Defined in: [types/agent.ts:189](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L189)

Result of an agent run, generic over structured output type T

#### Type Parameters

##### T

`T` = `void`

#### Properties

##### messages

> **messages**: [`Message`](#message)[]

Defined in: [types/agent.ts:198](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L198)

##### output

> **output**: `string` \| `null`

Defined in: [types/agent.ts:190](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L190)

##### structuredOutput

> **structuredOutput**: `T` *extends* `void` ? `undefined` : `T`

Defined in: [types/agent.ts:191](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L191)

##### toolCalls

> **toolCalls**: `object`[]

Defined in: [types/agent.ts:192](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L192)

###### approved

> **approved**: `boolean`

###### args

> **args**: [`JSONValue`](#jsonvalue)

###### result

> **result**: [`JSONValue`](#jsonvalue)

###### toolName

> **toolName**: `string`

##### usage?

> `optional` **usage?**: [`UsageData`](#usagedata)

Defined in: [types/agent.ts:199](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L199)

***

### AgentSDKErrorOptions

Defined in: [errors.ts:5](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L5)

Options for constructing an AgentSDKError

#### Extends

- `ErrorOptions`

#### Properties

##### code?

> `optional` **code?**: `string`

Defined in: [errors.ts:7](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L7)

Machine-readable error code

##### httpStatus?

> `optional` **httpStatus?**: `number`

Defined in: [errors.ts:11](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L11)

HTTP status code hint (e.g. 401, 429, 500)

##### providerRequestSent?

> `optional` **providerRequestSent?**: `boolean`

Defined in: [errors.ts:13](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L13)

False only when the backend proves model dispatch was not entered.

##### retryable?

> `optional` **retryable?**: `boolean`

Defined in: [errors.ts:9](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/errors.ts#L9)

Whether this error is retryable (default: false)

***

### BackendOptionsMap

Defined in: [registry.ts:20](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/registry.ts#L20)

Map of built-in backend names to their options types

#### Properties

##### claude

> **claude**: [`ClaudeBackendOptions`](#claudebackendoptions)

Defined in: [registry.ts:22](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/registry.ts#L22)

##### copilot

> **copilot**: [`CopilotBackendOptions`](#copilotbackendoptions)

Defined in: [registry.ts:21](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/registry.ts#L21)

##### vercel-ai

> **vercel-ai**: [`VercelAIBackendOptions`](#vercelaibackendoptions)

Defined in: [registry.ts:23](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/registry.ts#L23)

***

### CallDefaults

Defined in: [types/agent.ts:169](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L169)

Per-call defaults that can be provided at agent creation time.
 Each field can also be overridden on individual calls via RunOptions.

#### Properties

##### model?

> `optional` **model?**: `string`

Defined in: [types/agent.ts:171](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L171)

Default model (overridable per-call via RunOptions.model)

##### modelParams?

> `optional` **modelParams?**: [`ModelParams`](#modelparams-1)

Defined in: [types/agent.ts:173](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L173)

Default model parameters

##### providerOptions?

> `optional` **providerOptions?**: `Record`\<`string`, `Record`\<`string`, `unknown`\>\>

Defined in: [types/agent.ts:179](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L179)

Provider-specific options passed through to the underlying SDK.
 For Vercel AI: passed as providerOptions to generateText/streamText.
 Example: { google: { thinkingConfig: { thinkingBudget: 1024 } } }

##### tools?

> `optional` **tools?**: [`ToolDefinition`](#tooldefinition)\<`unknown`\>[]

Defined in: [types/agent.ts:175](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L175)

Default tools (overridable per-call via RunOptions.tools)

***

### CallOptions

Defined in: [types/agent.ts:16](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L16)

Per-call overrides passed to run(), stream(), runStructured().
 Allows overriding the model, tools, signal, and other parameters
 on a per-request basis without modifying the agent configuration.

#### Extended by

- [`RunOptions`](#runoptions)

#### Properties

##### maxTokens?

> `optional` **maxTokens?**: `number`

Defined in: [types/agent.ts:30](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L30)

Per-call token limit

##### model?

> `optional` **model?**: `string`

Defined in: [types/agent.ts:18](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L18)

Override the default model for this call

##### providerOptions?

> `optional` **providerOptions?**: `Record`\<`string`, `unknown`\>

Defined in: [types/agent.ts:26](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L26)

Provider-specific options passed through to the underlying SDK

##### retry?

> `optional` **retry?**: [`RetryConfig`](#retryconfig)

Defined in: [types/agent.ts:32](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L32)

Retry configuration for this call

##### signal?

> `optional` **signal?**: `AbortSignal`

Defined in: [types/agent.ts:22](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L22)

Per-call abort signal

##### systemMessage?

> `optional` **systemMessage?**: `string`

Defined in: [types/agent.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L24)

Override system message for this call

##### timeout?

> `optional` **timeout?**: `number`

Defined in: [types/agent.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L28)

Per-call timeout in milliseconds

##### tools?

> `optional` **tools?**: [`ToolDefinition`](#tooldefinition)\<`unknown`\>[]

Defined in: [types/agent.ts:20](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L20)

Override/extend tools for this call

***

### ClaudeBackendOptions

Defined in: [types/backends.ts:21](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L21)

Options for Claude CLI backend

#### Properties

##### cliPath?

> `optional` **cliPath?**: `string`

Defined in: [types/backends.ts:22](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L22)

##### env?

> `optional` **env?**: `Record`\<`string`, `string` \| `undefined`\>

Defined in: [types/backends.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L28)

Custom environment variables merged into the subprocess env

##### maxTurns?

> `optional` **maxTurns?**: `number`

Defined in: [types/backends.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L24)

##### oauthToken?

> `optional` **oauthToken?**: `string`

Defined in: [types/backends.ts:26](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L26)

OAuth token for Claude authentication (set as CLAUDE_CODE_OAUTH_TOKEN env var)

##### resumeSessionId?

> `optional` **resumeSessionId?**: `string`

Defined in: [types/backends.ts:31](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L31)

Session ID to resume after server restart. On startup, the backend attempts
 to resume this session before creating a new one.

##### workingDirectory?

> `optional` **workingDirectory?**: `string`

Defined in: [types/backends.ts:23](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L23)

***

### CopilotBackendOptions

Defined in: [types/backends.ts:2](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L2)

Options for Copilot CLI backend

#### Properties

##### cliArgs?

> `optional` **cliArgs?**: `string`[]

Defined in: [types/backends.ts:8](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L8)

Extra CLI arguments passed to the Copilot subprocess (e.g. ["--allow-all"])

##### cliPath?

> `optional` **cliPath?**: `string`

Defined in: [types/backends.ts:3](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L3)

##### env?

> `optional` **env?**: `Record`\<`string`, `string` \| `undefined`\>

Defined in: [types/backends.ts:14](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L14)

Custom environment variables merged into the subprocess env

##### githubToken?

> `optional` **githubToken?**: `string`

Defined in: [types/backends.ts:5](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L5)

##### resumeSessionId?

> `optional` **resumeSessionId?**: `string`

Defined in: [types/backends.ts:17](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L17)

Session ID to resume after server restart. On startup, the backend attempts
 to resume this session before creating a new one.

##### startupTimeoutMs?

> `optional` **startupTimeoutMs?**: `number`

Defined in: [types/backends.ts:12](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L12)

Timeout in milliseconds for CLI startup and auth check (default: 30000).

##### timeout?

> `optional` **timeout?**: `number`

Defined in: [types/backends.ts:10](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L10)

Timeout in milliseconds for sendAndWait() calls. When undefined, uses copilot-sdk default (60s).

##### useLoggedInUser?

> `optional` **useLoggedInUser?**: `boolean`

Defined in: [types/backends.ts:6](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L6)

##### workingDirectory?

> `optional` **workingDirectory?**: `string`

Defined in: [types/backends.ts:4](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L4)

***

### ErrorHandlingConfig

Defined in: [types/agent.ts:117](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L117)

Error handling strategy configuration

#### Properties

##### onError?

> `optional` **onError?**: (`error`, `context`) => `void`

Defined in: [types/agent.ts:123](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L123)

Global error callback for monitoring

###### Parameters

###### error

`Error`

###### context

###### phase

`"tool"` \| `"llm"` \| `"permission"` \| `"ask-user"`

###### Returns

`void`

##### onToolError?

> `optional` **onToolError?**: `"fail"` \| `"continue"` \| `"ask-llm"`

Defined in: [types/agent.ts:119](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L119)

What to do when a tool throws

##### retryLLM?

> `optional` **retryLLM?**: `object`

Defined in: [types/agent.ts:121](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L121)

Retry config for transient LLM failures

###### backoffMs

> **backoffMs**: `number`

###### maxAttempts

> **maxAttempts**: `number`

***

### IAgent

Defined in: [types/agent.ts:210](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L210)

Core agent interface — run prompts, stream events, manage lifecycle

#### Properties

##### sessionId

> `readonly` **sessionId**: `string` \| `undefined`

Defined in: [types/agent.ts:213](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L213)

The CLI session ID when using persistent session mode. Undefined in per-call mode
 or before the first call. Can be stored externally for session resume.

#### Methods

##### abort()

> **abort**(): `void`

Defined in: [types/agent.ts:238](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L238)

Abort the current operation. No-op if not running.

###### Returns

`void`

##### dispose()

> **dispose**(): `void`

Defined in: [types/agent.ts:246](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L246)

Release resources. After dispose(), agent must not be used.

###### Returns

`void`

##### getConfig()

> **getConfig**(): `Readonly`\<[`FullAgentConfig`](#fullagentconfig)\>

Defined in: [types/agent.ts:244](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L244)

Get frozen agent configuration.

###### Returns

`Readonly`\<[`FullAgentConfig`](#fullagentconfig)\>

##### getState()

> **getState**(): [`AgentState`](#agentstate)

Defined in: [types/agent.ts:242](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L242)

Get current agent lifecycle state.

###### Returns

[`AgentState`](#agentstate)

##### interrupt()

> **interrupt**(): `Promise`\<`void`\>

Defined in: [types/agent.ts:240](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L240)

Gracefully interrupt the current operation. Resolves when the backend acknowledges.

###### Returns

`Promise`\<`void`\>

##### run()

> **run**(`prompt`, `options`): `Promise`\<[`AgentResult`](#agentresult)\<`void`\>\>

Defined in: [types/agent.ts:215](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L215)

Run a single prompt and return the result. Wraps prompt in a user message.

###### Parameters

###### prompt

[`MessageContent`](#messagecontent)

###### options

[`RunOptions`](#runoptions)

###### Returns

`Promise`\<[`AgentResult`](#agentresult)\<`void`\>\>

##### runStructured()

> **runStructured**\<`T`\>(`prompt`, `schema`, `options`): `Promise`\<[`AgentResult`](#agentresult)\<`T`\>\>

Defined in: [types/agent.ts:222](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L222)

Run with structured output validated against a Zod schema.

###### Type Parameters

###### T

`T`

###### Parameters

###### prompt

[`MessageContent`](#messagecontent)

###### schema

[`StructuredOutputConfig`](#structuredoutputconfig)\<`T`\>

###### options

[`RunOptions`](#runoptions)

###### Returns

`Promise`\<[`AgentResult`](#agentresult)\<`T`\>\>

##### runWithContext()

> **runWithContext**(`messages`, `options`): `Promise`\<[`AgentResult`](#agentresult)\<`void`\>\>

Defined in: [types/agent.ts:217](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L217)

Run with full conversation history. Messages are passed directly to the backend.

###### Parameters

###### messages

[`Message`](#message)[]

###### options

[`RunOptions`](#runoptions)

###### Returns

`Promise`\<[`AgentResult`](#agentresult)\<`void`\>\>

##### stream()

> **stream**(`prompt`, `options`): `AsyncIterable`\<[`AgentEvent`](#agentevent)\>

Defined in: [types/agent.ts:228](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L228)

Stream events for a single prompt. Wraps prompt in a user message.

###### Parameters

###### prompt

[`MessageContent`](#messagecontent)

###### options

[`RunOptions`](#runoptions)

###### Returns

`AsyncIterable`\<[`AgentEvent`](#agentevent)\>

##### streamWithContext()

> **streamWithContext**(`messages`, `options`): `AsyncIterable`\<[`AgentEvent`](#agentevent)\>

Defined in: [types/agent.ts:233](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L233)

Stream events with full conversation history. Messages are passed directly to the backend.

###### Parameters

###### messages

[`Message`](#message)[]

###### options

[`RunOptions`](#runoptions)

###### Returns

`AsyncIterable`\<[`AgentEvent`](#agentevent)\>

***

### IAgentService

Defined in: [types/agent.ts:252](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L252)

Backend service interface — creates agents, lists models, validates config

#### Properties

##### name

> `readonly` **name**: `string`

Defined in: [types/agent.ts:253](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L253)

#### Methods

##### createAgent()

> **createAgent**(`config`): [`IAgent`](#iagent)

Defined in: [types/agent.ts:254](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L254)

###### Parameters

###### config

[`FullAgentConfig`](#fullagentconfig)

###### Returns

[`IAgent`](#iagent)

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [types/agent.ts:257](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L257)

###### Returns

`Promise`\<`void`\>

##### listModels()

> **listModels**(): `Promise`\<[`ModelInfo`](#modelinfo)[]\>

Defined in: [types/agent.ts:255](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L255)

###### Returns

`Promise`\<[`ModelInfo`](#modelinfo)[]\>

##### validate()

> **validate**(): `Promise`\<[`ValidationResult`](#validationresult)\>

Defined in: [types/agent.ts:256](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L256)

###### Returns

`Promise`\<[`ValidationResult`](#validationresult)\>

***

### IPermissionStore

Defined in: [permission-store.ts:9](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L9)

Pluggable store for persisting permission (scope) decisions across runs.

#### Methods

##### approve()

> **approve**(`toolName`, `scope`): `Promise`\<`void`\>

Defined in: [permission-store.ts:14](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L14)

Store an approval decision

###### Parameters

###### toolName

`string`

###### scope

[`PermissionScope`](#permissionscope)

###### Returns

`Promise`\<`void`\>

##### clear()

> **clear**(): `Promise`\<`void`\>

Defined in: [permission-store.ts:20](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L20)

Clear all approvals

###### Returns

`Promise`\<`void`\>

##### dispose()

> **dispose**(): `Promise`\<`void`\>

Defined in: [permission-store.ts:23](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L23)

Dispose resources

###### Returns

`Promise`\<`void`\>

##### isApproved()

> **isApproved**(`toolName`): `Promise`\<`boolean`\>

Defined in: [permission-store.ts:11](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L11)

Check if tool is already approved

###### Parameters

###### toolName

`string`

###### Returns

`Promise`\<`boolean`\>

##### revoke()

> **revoke**(`toolName`): `Promise`\<`void`\>

Defined in: [permission-store.ts:17](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L17)

Revoke approval for a tool

###### Parameters

###### toolName

`string`

###### Returns

`Promise`\<`void`\>

***

### LocalToolRefusal

Defined in: [types/events.ts:29](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L29)

A native parse refusal for one observed call, before any tool execution.
This does not mean the model request was unsent or authorize a retry.

#### Properties

##### args?

> `optional` **args?**: [`JSONValue`](#jsonvalue)

Defined in: [types/events.ts:33](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L33)

##### providerExecuted

> **providerExecuted**: `false`

Defined in: [types/events.ts:35](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L35)

##### reason

> **reason**: `"no_such_tool"` \| `"invalid_tool_input"`

Defined in: [types/events.ts:30](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L30)

##### toolCallId

> **toolCallId**: `string`

Defined in: [types/events.ts:31](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L31)

##### toolExecutionStarted

> **toolExecutionStarted**: `false`

Defined in: [types/events.ts:34](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L34)

##### toolName

> **toolName**: `string`

Defined in: [types/events.ts:32](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L32)

***

### ModelInfo

Defined in: [types/models.ts:2](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/models.ts#L2)

Model metadata returned by listModels()

#### Properties

##### capabilities?

> `optional` **capabilities?**: `string`[]

Defined in: [types/models.ts:11](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/models.ts#L11)

Model capabilities (e.g. "vision", "tools", "structured")

##### contextWindow?

> `optional` **contextWindow?**: `number`

Defined in: [types/models.ts:9](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/models.ts#L9)

Context window size in tokens

##### id

> **id**: `string`

Defined in: [types/models.ts:3](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/models.ts#L3)

##### name?

> `optional` **name?**: `string`

Defined in: [types/models.ts:4](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/models.ts#L4)

##### provider?

> `optional` **provider?**: `string`

Defined in: [types/models.ts:5](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/models.ts#L5)

##### tier?

> `optional` **tier?**: `"fast"` \| `"standard"` \| `"premium"`

Defined in: [types/models.ts:7](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/models.ts#L7)

Model tier for UI categorization and cost hints

***

### ModelParams

Defined in: [types/models.ts:15](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/models.ts#L15)

LLM model parameters

#### Properties

##### maxTokens?

> `optional` **maxTokens?**: `number`

Defined in: [types/models.ts:17](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/models.ts#L17)

##### stopSequences?

> `optional` **stopSequences?**: `string`[]

Defined in: [types/models.ts:19](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/models.ts#L19)

##### temperature?

> `optional` **temperature?**: `number`

Defined in: [types/models.ts:16](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/models.ts#L16)

##### topP?

> `optional` **topP?**: `number`

Defined in: [types/models.ts:18](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/models.ts#L18)

***

### PermissionDecision

Defined in: [types/permissions.ts:17](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L17)

What the permission callback returns

#### Properties

##### allowed

> **allowed**: `boolean`

Defined in: [types/permissions.ts:18](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L18)

##### modifiedInput?

> `optional` **modifiedInput?**: `Record`\<`string`, `unknown`\>

Defined in: [types/permissions.ts:22](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L22)

Modified tool arguments (tool args may be altered by user)

##### reason?

> `optional` **reason?**: `string`

Defined in: [types/permissions.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L24)

Denial reason (if denied)

##### scope?

> `optional` **scope?**: [`PermissionScope`](#permissionscope)

Defined in: [types/permissions.ts:20](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L20)

How long to remember this decision

***

### PermissionRequest

Defined in: [types/permissions.ts:5](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L5)

What the permission callback receives

#### Properties

##### rawSDKRequest?

> `optional` **rawSDKRequest?**: `unknown`

Defined in: [types/permissions.ts:13](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L13)

Original SDK permission request (for pass-through)

##### suggestedScope?

> `optional` **suggestedScope?**: [`PermissionScope`](#permissionscope)

Defined in: [types/permissions.ts:11](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L11)

SDK-suggested scope (from Claude CLI's suggestions)

##### toolArgs

> **toolArgs**: `Record`\<`string`, `unknown`\>

Defined in: [types/permissions.ts:7](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L7)

##### toolCallId?

> `optional` **toolCallId?**: `string`

Defined in: [types/permissions.ts:9](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L9)

Unique identifier for this specific tool call

##### toolName

> **toolName**: `string`

Defined in: [types/permissions.ts:6](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L6)

***

### ProviderAcknowledgment

Defined in: [types/agent.ts:63](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L63)

Native response identity observed inside one physical provider invocation.
provider is the configured adapter namespace, not evidence of an upstream account.
Optional metadata is supplied only by the provider, never synthesized.

#### Properties

##### modelCallIndex

> **modelCallIndex**: `number`

Defined in: [types/agent.ts:67](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L67)

Zero-based native doGenerate/doStream invocation index within this run.
Resets for each run/stream operation; separate physical calls have separate indices.

##### modelId?

> `optional` **modelId?**: `string`

Defined in: [types/agent.ts:70](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L70)

##### provider

> **provider**: `string`

Defined in: [types/agent.ts:64](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L64)

##### responseId

> **responseId**: `string`

Defined in: [types/agent.ts:69](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L69)

Exact provider-supplied ID, never an AI SDK fallback or locally generated ID.

##### timestamp?

> `optional` **timestamp?**: `string`

Defined in: [types/agent.ts:72](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L72)

ISO timestamp derived from native response metadata.

***

### RetryConfig

Defined in: [types/agent.ts:38](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L38)

Configuration for automatic retries on transient errors

#### Properties

##### backoffMultiplier?

> `optional` **backoffMultiplier?**: `number`

Defined in: [types/agent.ts:44](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L44)

Backoff multiplier (default: 2)

##### initialDelayMs?

> `optional` **initialDelayMs?**: `number`

Defined in: [types/agent.ts:42](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L42)

Initial delay in ms before first retry (default: 1000)

##### maxRetries?

> `optional` **maxRetries?**: `number`

Defined in: [types/agent.ts:40](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L40)

Maximum number of retries (default: 0 — no retry)

##### retryableErrors?

> `optional` **retryableErrors?**: [`ErrorCode`](#errorcode)[]

Defined in: [types/agent.ts:46](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L46)

Which error codes to retry (default: all recoverable codes)

***

### RunOptions

Defined in: [types/agent.ts:78](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L78)

Options passed to agent.run() / agent.stream().
 Extends CallOptions with run-specific fields (context, activityTimeoutMs).
 model is REQUIRED — every agent call must specify the model explicitly.

#### Extends

- [`CallOptions`](#calloptions)

#### Properties

##### activityTimeoutMs?

> `optional` **activityTimeoutMs?**: `number`

Defined in: [types/agent.ts:99](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L99)

Inactivity timeout for streaming (ms). When set, the stream aborts if no
 event (including heartbeats/progress) arrives within this period. Resets on
 every received event. Default: no timeout. Only affects stream()/streamWithContext().

##### context?

> `optional` **context?**: `Record`\<`string`, `unknown`\>

Defined in: [types/agent.ts:82](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L82)

Arbitrary context passed to the agent run

##### maxTokens?

> `optional` **maxTokens?**: `number`

Defined in: [types/agent.ts:30](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L30)

Per-call token limit

###### Inherited from

[`CallOptions`](#calloptions).[`maxTokens`](#maxtokens)

##### model

> **model**: `string`

Defined in: [types/agent.ts:80](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L80)

Model to use for this call (required — no implicit defaults)

###### Overrides

[`CallOptions`](#calloptions).[`model`](#model-1)

##### onProviderAcknowledgment?

> `optional` **onProviderAcknowledgment?**: (`observation`) => `void` \| `Promise`\<`void`\>

Defined in: [types/agent.ts:95](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L95)

Vercel AI: called once per physical invocation on its first actual native
response ID, including an ID that first appears in a later stream chunk.
Missing ID means no callback. Optional metadata contains only values observed
at that point; no model or timestamp fallback is synthesized. Consistent
duplicate observations do not call again; contradictory ID or overlapping
metadata stops the invocation with ProviderAcknowledgmentError.

The callback is awaited before forwarding the observed chunk's metadata or
content to AI. Persistence failure keeps its original cause in a typed local
ProviderAcknowledgmentError: this sent effect remains unresolved, supplies no
unsent evidence, and is not automatically retried. Raw chunks are enabled only
while this hook is present, inspected for identity, and never exposed.

###### Parameters

###### observation

[`ProviderAcknowledgment`](#provideracknowledgment)

###### Returns

`void` \| `Promise`\<`void`\>

##### providerOptions?

> `optional` **providerOptions?**: `Record`\<`string`, `unknown`\>

Defined in: [types/agent.ts:26](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L26)

Provider-specific options passed through to the underlying SDK

###### Inherited from

[`CallOptions`](#calloptions).[`providerOptions`](#provideroptions-1)

##### retry?

> `optional` **retry?**: [`RetryConfig`](#retryconfig)

Defined in: [types/agent.ts:32](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L32)

Retry configuration for this call

###### Inherited from

[`CallOptions`](#calloptions).[`retry`](#retry)

##### signal?

> `optional` **signal?**: `AbortSignal`

Defined in: [types/agent.ts:22](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L22)

Per-call abort signal

###### Inherited from

[`CallOptions`](#calloptions).[`signal`](#signal)

##### systemMessage?

> `optional` **systemMessage?**: `string`

Defined in: [types/agent.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L24)

Override system message for this call

###### Inherited from

[`CallOptions`](#calloptions).[`systemMessage`](#systemmessage)

##### timeout?

> `optional` **timeout?**: `number`

Defined in: [types/agent.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L28)

Per-call timeout in milliseconds

###### Inherited from

[`CallOptions`](#calloptions).[`timeout`](#timeout-1)

##### tools?

> `optional` **tools?**: [`ToolDefinition`](#tooldefinition)\<`unknown`\>[]

Defined in: [types/agent.ts:20](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L20)

Override/extend tools for this call

###### Inherited from

[`CallOptions`](#calloptions).[`tools`](#tools-1)

***

### StreamContext

Defined in: [types/events.ts:84](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L84)

Context passed to stream middleware — immutable per stream invocation

#### Properties

##### abortController

> **abortController**: `AbortController`

Defined in: [types/events.ts:87](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L87)

##### backend

> **backend**: `string`

Defined in: [types/events.ts:86](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L86)

##### config

> **config**: `Readonly`\<`Record`\<`string`, `unknown`\>\>

Defined in: [types/events.ts:89](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L89)

Agent config snapshot. Loosely typed to avoid leaking internal FullAgentConfig to external middleware consumers.

##### model

> **model**: `string`

Defined in: [types/events.ts:85](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L85)

***

### StructuredOutputConfig

Defined in: [types/agent.ts:52](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L52)

Configuration for typed structured output from LLM

#### Type Parameters

##### T

`T` = `unknown`

#### Properties

##### description?

> `optional` **description?**: `string`

Defined in: [types/agent.ts:55](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L55)

##### name?

> `optional` **name?**: `string`

Defined in: [types/agent.ts:54](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L54)

##### schema

> **schema**: `ZodType`\<`T`\>

Defined in: [types/agent.ts:53](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L53)

***

### SupervisorHooks

Defined in: [types/permissions.ts:51](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L51)

Hooks for supervisor/UI to intercept agent actions

#### Properties

##### onAskUser?

> `optional` **onAskUser?**: (`request`, `signal`) => `Promise`\<[`UserInputResponse`](#userinputresponse)\>

Defined in: [types/permissions.ts:53](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L53)

###### Parameters

###### request

[`UserInputRequest`](#userinputrequest)

###### signal

`AbortSignal`

###### Returns

`Promise`\<[`UserInputResponse`](#userinputresponse)\>

##### onPermission?

> `optional` **onPermission?**: [`PermissionCallback`](#permissioncallback)

Defined in: [types/permissions.ts:52](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L52)

***

### TimeoutConfig

Defined in: [types/agent.ts:105](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L105)

Timeout configuration for agent operations

#### Properties

##### perLLMRequest?

> `optional` **perLLMRequest?**: `number`

Defined in: [types/agent.ts:111](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L111)

Max time for a single LLM request (ms)

##### perTool?

> `optional` **perTool?**: `number`

Defined in: [types/agent.ts:109](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L109)

Max time for a single tool execution (ms)

##### total?

> `optional` **total?**: `number`

Defined in: [types/agent.ts:107](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L107)

Max time for entire agent run (ms)

***

### ToolCall

Defined in: [types/tools.ts:36](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L36)

A tool call made by the LLM during execution

#### Properties

##### args

> **args**: [`JSONValue`](#jsonvalue)

Defined in: [types/tools.ts:39](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L39)

##### id

> **id**: `string`

Defined in: [types/tools.ts:37](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L37)

##### name

> **name**: `string`

Defined in: [types/tools.ts:38](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L38)

##### providerOptions?

> `optional` **providerOptions?**: `Record`\<`string`, `Record`\<`string`, [`JSONValue`](#jsonvalue)\>\>

Defined in: [types/tools.ts:41](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L41)

Native continuation metadata, such as a provider's opaque thought signature.

***

### ToolContext

Defined in: [types/tools.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L28)

Request-scoped context passed to tool execute functions via ChatRuntime.
 Contains session identity and user-defined metadata from the current session.

#### Properties

##### custom?

> `optional` **custom?**: `Record`\<`string`, `unknown`\>

Defined in: [types/tools.ts:32](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L32)

Custom metadata from the session (e.g. user ID, tenant, permissions)

##### sessionId

> **sessionId**: `string`

Defined in: [types/tools.ts:30](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L30)

Active chat session ID

***

### ToolDeclaration

Defined in: [types/tools.ts:5](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L5)

What the LLM sees — name, description, schema. Passed to all backends.

#### Extended by

- [`ToolDefinition`](#tooldefinition)

#### Type Parameters

##### TParams

`TParams` = `unknown`

#### Properties

##### description

> **description**: `string`

Defined in: [types/tools.ts:7](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L7)

##### metadata?

> `optional` **metadata?**: `object`

Defined in: [types/tools.ts:10](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L10)

###### category?

> `optional` **category?**: `string`

###### icon?

> `optional` **icon?**: `string`

###### tags?

> `optional` **tags?**: `string`[]

##### name

> **name**: `string`

Defined in: [types/tools.ts:6](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L6)

##### needsApproval?

> `optional` **needsApproval?**: `boolean`

Defined in: [types/tools.ts:9](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L9)

##### parameters

> **parameters**: `ZodType`\<`TParams`\>

Defined in: [types/tools.ts:8](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L8)

***

### ToolDefinition

Defined in: [types/tools.ts:21](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L21)

Full tool with execute function. Required for API-based backends.
 CLI backends extract declaration; execute map held internally.
 The optional second parameter receives request-scoped context
 when invoked through ChatRuntime (session ID, user data, custom metadata).

#### Extends

- [`ToolDeclaration`](#tooldeclaration)\<`TParams`\>

#### Type Parameters

##### TParams

`TParams` = `unknown`

#### Properties

##### description

> **description**: `string`

Defined in: [types/tools.ts:7](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L7)

###### Inherited from

[`ToolDeclaration`](#tooldeclaration).[`description`](#description-1)

##### execute

> **execute**: (`params`, `context?`) => `unknown`

Defined in: [types/tools.ts:23](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L23)

###### Parameters

###### params

`TParams`

###### context?

[`ToolContext`](#toolcontext)

###### Returns

`unknown`

##### metadata?

> `optional` **metadata?**: `object`

Defined in: [types/tools.ts:10](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L10)

###### category?

> `optional` **category?**: `string`

###### icon?

> `optional` **icon?**: `string`

###### tags?

> `optional` **tags?**: `string`[]

###### Inherited from

[`ToolDeclaration`](#tooldeclaration).[`metadata`](#metadata)

##### name

> **name**: `string`

Defined in: [types/tools.ts:6](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L6)

###### Inherited from

[`ToolDeclaration`](#tooldeclaration).[`name`](#name-4)

##### needsApproval?

> `optional` **needsApproval?**: `boolean`

Defined in: [types/tools.ts:9](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L9)

###### Inherited from

[`ToolDeclaration`](#tooldeclaration).[`needsApproval`](#needsapproval)

##### parameters

> **parameters**: `ZodType`\<`TParams`\>

Defined in: [types/tools.ts:8](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L8)

###### Inherited from

[`ToolDeclaration`](#tooldeclaration).[`parameters`](#parameters)

***

### ToolResult

Defined in: [types/tools.ts:45](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L45)

Result of executing a tool call

#### Properties

##### isError?

> `optional` **isError?**: `boolean`

Defined in: [types/tools.ts:49](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L49)

##### name

> **name**: `string`

Defined in: [types/tools.ts:47](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L47)

##### providerOptions?

> `optional` **providerOptions?**: `Record`\<`string`, `Record`\<`string`, [`JSONValue`](#jsonvalue)\>\>

Defined in: [types/tools.ts:50](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L50)

##### result

> **result**: [`JSONValue`](#jsonvalue)

Defined in: [types/tools.ts:48](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L48)

##### toolCallId

> **toolCallId**: `string`

Defined in: [types/tools.ts:46](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/tools.ts#L46)

***

### UsageData

Defined in: [types/events.ts:8](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L8)

Usage data from LLM execution — tokens consumed plus optional metadata

#### Properties

##### backend?

> `optional` **backend?**: `string`

Defined in: [types/events.ts:15](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L15)

##### cachedTokens?

> `optional` **cachedTokens?**: `number`

Defined in: [types/events.ts:21](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L21)

Number of prompt tokens served from the provider's cache, when reported.

##### completionTokens

> **completionTokens**: `number`

Defined in: [types/events.ts:10](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L10)

##### cost?

> `optional` **cost?**: `number`

Defined in: [types/events.ts:19](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L19)

Best-effort normalized request cost in USD, when the provider reports it.
 Populated by backends that can extract a numeric cost from provider metadata
 (e.g. OpenRouter via the Vercel AI backend). Undefined when unavailable.

##### model?

> `optional` **model?**: `string`

Defined in: [types/events.ts:14](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L14)

##### promptTokens

> **promptTokens**: `number`

Defined in: [types/events.ts:9](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L9)

##### providerMetadata?

> `optional` **providerMetadata?**: `Record`\<`string`, [`JSONValue`](#jsonvalue)\>

Defined in: [types/events.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L24)

Raw, provider-specific response metadata passed through untouched.
 Provider-agnostic escape hatch for fields the SDK does not normalize.

##### tokenUsageKnown?

> `optional` **tokenUsageKnown?**: `object`

Defined in: [types/events.ts:13](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L13)

Presence of measured cumulative token counters. False means the numeric
 count includes only the known prefix, not a measured zero for missing usage.

###### completionTokens

> **completionTokens**: `boolean`

###### promptTokens

> **promptTokens**: `boolean`

***

### UserInputRequest

Defined in: [types/permissions.ts:34](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L34)

Request for user input — separate from permissions

#### Properties

##### allowFreeform?

> `optional` **allowFreeform?**: `boolean`

Defined in: [types/permissions.ts:38](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L38)

Whether to allow freeform text input (default: true)

##### choices?

> `optional` **choices?**: `string`[]

Defined in: [types/permissions.ts:36](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L36)

##### question

> **question**: `string`

Defined in: [types/permissions.ts:35](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L35)

***

### UserInputResponse

Defined in: [types/permissions.ts:42](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L42)

Response from user to an input request

#### Properties

##### answer

> **answer**: `string`

Defined in: [types/permissions.ts:43](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L43)

##### selectedChoiceIndex?

> `optional` **selectedChoiceIndex?**: `number`

Defined in: [types/permissions.ts:47](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L47)

Index of selected choice (if choice was selected)

##### wasFreeform

> **wasFreeform**: `boolean`

Defined in: [types/permissions.ts:45](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L45)

true if user typed a custom answer instead of selecting a choice

***

### ValidationResult

Defined in: [types/models.ts:23](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/models.ts#L23)

Result of backend validation check

#### Properties

##### errors

> **errors**: `string`[]

Defined in: [types/models.ts:25](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/models.ts#L25)

##### valid

> **valid**: `boolean`

Defined in: [types/models.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/models.ts#L24)

***

### VercelAIBackendOptions

Defined in: [types/backends.ts:97](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L97)

Options for Vercel AI SDK backend

#### Properties

##### apiKey

> **apiKey**: `string`

Defined in: [types/backends.ts:98](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L98)

##### baseUrl?

> `optional` **baseUrl?**: `string`

Defined in: [types/backends.ts:100](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L100)

##### provider?

> `optional` **provider?**: `string`

Defined in: [types/backends.ts:99](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/backends.ts#L99)

## Type Aliases

### AgentEvent

> **AgentEvent** = \{ `text`: `string`; `type`: `"text_delta"`; \} \| \{ `text`: `string`; `type`: `"thinking_delta"`; \} \| \{ `args?`: [`JSONValue`](#jsonvalue); `toolCallId`: `string`; `toolName`: `string`; `type`: `"tool_call_start"`; \} \| \{ `result`: [`JSONValue`](#jsonvalue); `toolCallId`: `string`; `toolName`: `string`; `type`: `"tool_call_end"`; \} \| \{ `request`: [`PermissionRequest`](#permissionrequest); `type`: `"permission_request"`; \} \| \{ `decision`: [`PermissionDecision`](#permissiondecision); `toolName`: `string`; `type`: `"permission_response"`; \} \| \{ `request`: [`UserInputRequest`](#userinputrequest); `type`: `"ask_user"`; \} \| \{ `answer`: `string`; `type`: `"ask_user_response"`; \} \| \{ `type`: `"thinking_start"`; \} \| \{ `type`: `"thinking_end"`; \} \| \{ `backend?`: `string`; `cachedTokens?`: `number`; `completionTokens`: `number`; `cost?`: `number`; `model?`: `string`; `promptTokens`: `number`; `providerMetadata?`: `Record`\<`string`, [`JSONValue`](#jsonvalue)\>; `tokenUsageKnown?`: \{ `completionTokens`: `boolean`; `promptTokens`: `boolean`; \}; `type`: `"usage_update"`; \} \| \{ `backend`: `string`; `sessionId`: `string`; `transcriptPath?`: `string`; `type`: `"session_info"`; \} \| \{ `type`: `"heartbeat"`; \} \| \{ `cause?`: [`AgentSDKError`](#agentsdkerror); `code?`: [`ErrorCode`](#errorcode); `error`: `string`; `localToolRefusal?`: [`LocalToolRefusal`](#localtoolrefusal); `recoverable`: `boolean`; `toolCallId?`: `string`; `toolName?`: `string`; `type`: `"error"`; \} \| \{ `finalOutput`: `string` \| `null`; `finishReason?`: `string`; `messages?`: [`Message`](#message)[]; `streamed?`: `boolean`; `structuredOutput?`: `unknown`; `type`: `"done"`; \}

Defined in: [types/events.ts:39](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L39)

Events emitted during streaming agent execution

#### Union Members

##### Type Literal

\{ `text`: `string`; `type`: `"text_delta"`; \}

***

##### Type Literal

\{ `text`: `string`; `type`: `"thinking_delta"`; \}

***

##### Type Literal

\{ `args?`: [`JSONValue`](#jsonvalue); `toolCallId`: `string`; `toolName`: `string`; `type`: `"tool_call_start"`; \}

***

##### Type Literal

\{ `result`: [`JSONValue`](#jsonvalue); `toolCallId`: `string`; `toolName`: `string`; `type`: `"tool_call_end"`; \}

***

##### Type Literal

\{ `request`: [`PermissionRequest`](#permissionrequest); `type`: `"permission_request"`; \}

***

##### Type Literal

\{ `decision`: [`PermissionDecision`](#permissiondecision); `toolName`: `string`; `type`: `"permission_response"`; \}

***

##### Type Literal

\{ `request`: [`UserInputRequest`](#userinputrequest); `type`: `"ask_user"`; \}

***

##### Type Literal

\{ `answer`: `string`; `type`: `"ask_user_response"`; \}

***

##### Type Literal

\{ `type`: `"thinking_start"`; \}

***

##### Type Literal

\{ `type`: `"thinking_end"`; \}

***

##### Type Literal

\{ `backend?`: `string`; `cachedTokens?`: `number`; `completionTokens`: `number`; `cost?`: `number`; `model?`: `string`; `promptTokens`: `number`; `providerMetadata?`: `Record`\<`string`, [`JSONValue`](#jsonvalue)\>; `tokenUsageKnown?`: \{ `completionTokens`: `boolean`; `promptTokens`: `boolean`; \}; `type`: `"usage_update"`; \}

***

##### Type Literal

\{ `backend`: `string`; `sessionId`: `string`; `transcriptPath?`: `string`; `type`: `"session_info"`; \}

***

##### Type Literal

\{ `type`: `"heartbeat"`; \}

***

##### Type Literal

\{ `cause?`: [`AgentSDKError`](#agentsdkerror); `code?`: [`ErrorCode`](#errorcode); `error`: `string`; `localToolRefusal?`: [`LocalToolRefusal`](#localtoolrefusal); `recoverable`: `boolean`; `toolCallId?`: `string`; `toolName?`: `string`; `type`: `"error"`; \}

###### cause?

> `optional` **cause?**: [`AgentSDKError`](#agentsdkerror)

Primary native failure for in-process consumers; do not serialize raw Error causes.

###### code?

> `optional` **code?**: [`ErrorCode`](#errorcode)

###### error

> **error**: `string`

###### localToolRefusal?

> `optional` **localToolRefusal?**: [`LocalToolRefusal`](#localtoolrefusal)

###### recoverable

> **recoverable**: `boolean`

###### toolCallId?

> `optional` **toolCallId?**: `string`

Present for a failed tool invocation, never a successful tool result.

###### toolName?

> `optional` **toolName?**: `string`

###### type

> **type**: `"error"`

***

##### Type Literal

\{ `finalOutput`: `string` \| `null`; `finishReason?`: `string`; `messages?`: [`Message`](#message)[]; `streamed?`: `boolean`; `structuredOutput?`: `unknown`; `type`: `"done"`; \}

###### finalOutput

> **finalOutput**: `string` \| `null`

###### finishReason?

> `optional` **finishReason?**: `string`

###### messages?

> `optional` **messages?**: [`Message`](#message)[]

Completed native response messages only. Private continuation data is not
public prose; tool results still belong to the caller's execution authority.

###### streamed?

> `optional` **streamed?**: `boolean`

###### structuredOutput?

> `optional` **structuredOutput?**: `unknown`

###### type

> **type**: `"done"`

***

### AgentState

> **AgentState** = `"idle"` \| `"running"` \| `"streaming"` \| `"disposed"`

Defined in: [types/agent.ts:205](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L205)

Agent lifecycle state

***

### BackendFactory

> **BackendFactory**\<`TOptions`\> = (`options`) => [`IAgentService`](#iagentservice) \| `Promise`\<[`IAgentService`](#iagentservice)\>

Defined in: [registry.ts:15](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/registry.ts#L15)

Factory function that creates a backend service from options

#### Type Parameters

##### TOptions

`TOptions` = `unknown`

#### Parameters

##### options

`TOptions`

#### Returns

[`IAgentService`](#iagentservice) \| `Promise`\<[`IAgentService`](#iagentservice)\>

***

### BuiltinBackendName

> **BuiltinBackendName** = keyof [`BackendOptionsMap`](#backendoptionsmap)

Defined in: [registry.ts:27](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/registry.ts#L27)

All known backend names (built-in + custom)

***

### ContentPart

> **ContentPart** = \{ `providerOptions?`: `Record`\<`string`, `Record`\<`string`, [`JSONValue`](#jsonvalue)\>\>; `text`: `string`; `type`: `"text"`; \} \| \{ `providerOptions?`: `Record`\<`string`, `Record`\<`string`, [`JSONValue`](#jsonvalue)\>\>; `text`: `string`; `type`: `"reasoning"`; \} \| \{ `data`: `string`; `mimeType`: `string`; `type`: `"image"`; \}

Defined in: [types/messages.ts:8](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/messages.ts#L8)

Individual content part within a multi-part message

***

### FullAgentConfig

> **FullAgentConfig** = [`AgentConfig`](#agentconfig) & [`CallDefaults`](#calldefaults)

Defined in: [types/agent.ts:184](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/agent.ts#L184)

Full agent configuration: identity + per-call defaults.
 This is what createAgent() accepts. Backward-compatible with the old AgentConfig shape.

***

### JSONValue

> **JSONValue** = `string` \| `number` \| `boolean` \| `null` \| [`JSONValue`](#jsonvalue)[] \| \{\[`key`: `string`\]: [`JSONValue`](#jsonvalue); \}

Defined in: [types/json.ts:2](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/json.ts#L2)

JSON-serializable value used for tool arguments and results

***

### Message

> **Message** = \{ `content`: [`MessageContent`](#messagecontent); `role`: `"user"`; \} \| \{ `content`: [`MessageContent`](#messagecontent); `role`: `"assistant"`; `thinking?`: `string`; `toolCalls?`: [`ToolCall`](#toolcall)[]; \} \| \{ `content?`: `string`; `role`: `"tool"`; `toolResults`: [`ToolResult`](#toolresult)[]; \} \| \{ `content`: `string`; `role`: `"system"`; \}

Defined in: [types/messages.ts:14](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/messages.ts#L14)

Conversation message — discriminated union on `role`

***

### MessageContent

> **MessageContent** = `string` \| [`ContentPart`](#contentpart)[]

Defined in: [types/messages.ts:5](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/messages.ts#L5)

Message content. Native reasoning is continuation data, not visible prose.

***

### PermissionCallback

> **PermissionCallback** = (`request`, `signal`) => `Promise`\<[`PermissionDecision`](#permissiondecision)\>

Defined in: [types/permissions.ts:28](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L28)

Permission callback signature

#### Parameters

##### request

[`PermissionRequest`](#permissionrequest)

##### signal

`AbortSignal`

#### Returns

`Promise`\<[`PermissionDecision`](#permissiondecision)\>

***

### PermissionScope

> **PermissionScope** = `"once"` \| `"session"` \| `"project"` \| `"always"`

Defined in: [types/permissions.ts:2](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/permissions.ts#L2)

Scope for "remember this decision"

***

### StreamMiddleware

> **StreamMiddleware** = (`source`, `context`) => `AsyncIterable`\<[`AgentEvent`](#agentevent)\>

Defined in: [types/events.ts:94](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/events.ts#L94)

A composable transform over the agent event stream.
 Receives the upstream source and context, returns a transformed stream.

#### Parameters

##### source

`AsyncIterable`\<[`AgentEvent`](#agentevent)\>

##### context

[`StreamContext`](#streamcontext)

#### Returns

`AsyncIterable`\<[`AgentEvent`](#agentevent)\>

## Functions

### buildSystemPrompt()

> **buildSystemPrompt**(`base`, `schemaInstruction?`): `string`

Defined in: [utils/messages.ts:29](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/utils/messages.ts#L29)

Build a system prompt with optional structured output instruction

#### Parameters

##### base

`string`

##### schemaInstruction?

`string`

#### Returns

`string`

***

### classifyAgentError()

> **classifyAgentError**(`error`): [`ErrorCode`](#errorcode)

Defined in: [types/errors.ts:73](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L73)

Classify an error message string into an ErrorCode

#### Parameters

##### error

`string` \| `Error`

#### Returns

[`ErrorCode`](#errorcode)

***

### contentToText()

> **contentToText**(`content`): `string`

Defined in: [utils/messages.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/utils/messages.ts#L24)

Convert MessageContent to plain text

#### Parameters

##### content

[`MessageContent`](#messagecontent)

#### Returns

`string`

***

### createAgentService()

#### Call Signature

> **createAgentService**\<`K`\>(`name`, `options`, `configId?`): `Promise`\<[`IAgentService`](#iagentservice)\>

Defined in: [registry.ts:171](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/registry.ts#L171)

Create a backend service with type-safe options.
 When `configId` is provided, the service instance is cached and reused
 on subsequent calls with the same name+configId pair. Without configId,
 a new instance is created every call.

##### Type Parameters

###### K

`K` *extends* keyof [`BackendOptionsMap`](#backendoptionsmap)

##### Parameters

###### name

`K`

###### options

[`BackendOptionsMap`](#backendoptionsmap)\[`K`\]

###### configId?

`string`

##### Returns

`Promise`\<[`IAgentService`](#iagentservice)\>

#### Call Signature

> **createAgentService**(`name`, `options`, `configId?`): `Promise`\<[`IAgentService`](#iagentservice)\>

Defined in: [registry.ts:176](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/registry.ts#L176)

Create a backend service with type-safe options.
 When `configId` is provided, the service instance is cached and reused
 on subsequent calls with the same name+configId pair. Without configId,
 a new instance is created every call.

##### Parameters

###### name

`string`

###### options

`unknown`

###### configId?

`string`

##### Returns

`Promise`\<[`IAgentService`](#iagentservice)\>

***

### createDefaultPermissionStore()

> **createDefaultPermissionStore**(`projectDir?`): [`CompositePermissionStore`](#compositepermissionstore)

Defined in: [permission-store.ts:187](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/permission-store.ts#L187)

Create a default composite store with separate project and user-level persistence.

#### Parameters

##### projectDir?

`string`

#### Returns

[`CompositePermissionStore`](#compositepermissionstore)

***

### disposeBackend()

> **disposeBackend**(`name`, `configId?`): `Promise`\<`number`\>

Defined in: [registry.ts:84](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/registry.ts#L84)

Dispose all cached service instances for a backend, or a single named config.
 Returns the number of instances disposed.

#### Parameters

##### name

`string`

##### configId?

`string`

#### Returns

`Promise`\<`number`\>

***

### getTextContent()

> **getTextContent**(`content`): `string`

Defined in: [types/guards.ts:24](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/guards.ts#L24)

Extract text from MessageContent regardless of format

#### Parameters

##### content

[`MessageContent`](#messagecontent)

#### Returns

`string`

***

### hasBackend()

> **hasBackend**(`name`): `boolean`

Defined in: [registry.ts:63](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/registry.ts#L63)

Check if a backend is registered (eagerly or lazily)

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### isMultiPartContent()

> **isMultiPartContent**(`content`): `content is ContentPart[]`

Defined in: [types/guards.ts:17](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/guards.ts#L17)

Type guard: checks if MessageContent is multi-part array

#### Parameters

##### content

[`MessageContent`](#messagecontent)

#### Returns

`content is ContentPart[]`

***

### isRecoverableErrorCode()

> **isRecoverableErrorCode**(`code`): `boolean`

Defined in: [types/errors.ts:68](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/errors.ts#L68)

Check if an error code is recoverable

#### Parameters

##### code

[`ErrorCode`](#errorcode)

#### Returns

`boolean`

***

### isTextContent()

> **isTextContent**(`content`): `content is string`

Defined in: [types/guards.ts:12](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/guards.ts#L12)

Type guard: checks if MessageContent is plain string

#### Parameters

##### content

[`MessageContent`](#messagecontent)

#### Returns

`content is string`

***

### isToolDefinition()

> **isToolDefinition**(`tool`): `tool is ToolDefinition<unknown>`

Defined in: [types/guards.ts:5](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/types/guards.ts#L5)

Type guard: checks if a ToolDeclaration has an execute function (i.e., is a ToolDefinition)

#### Parameters

##### tool

[`ToolDeclaration`](#tooldeclaration)

#### Returns

`tool is ToolDefinition<unknown>`

***

### listBackends()

> **listBackends**(): `string`[]

Defined in: [registry.ts:68](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/registry.ts#L68)

List all registered backend names (eager + lazy)

#### Returns

`string`[]

***

### listConfigs()

> **listConfigs**(`name`): `string`[]

Defined in: [registry.ts:109](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/registry.ts#L109)

List all active config IDs for a backend

#### Parameters

##### name

`string`

#### Returns

`string`[]

***

### messagesToPrompt()

> **messagesToPrompt**(`messages`): `string`

Defined in: [utils/messages.ts:5](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/utils/messages.ts#L5)

Convert our Message[] to a flat prompt string (for CLIs that accept text)

#### Parameters

##### messages

[`Message`](#message)[]

#### Returns

`string`

***

### registerBackend()

> **registerBackend**\<`TOptions`\>(`name`, `factory`): `void`

Defined in: [registry.ts:47](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/registry.ts#L47)

Register a custom backend factory

#### Type Parameters

##### TOptions

`TOptions` = `unknown`

#### Parameters

##### name

`string`

##### factory

[`BackendFactory`](#backendfactory)\<`TOptions`\>

#### Returns

`void`

***

### registerLazyBackend()

> **registerLazyBackend**(`name`, `loader`): `void`

Defined in: [registry.ts:158](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/registry.ts#L158)

Register a lazy-loaded backend. The loader is called once on first use,
then the resulting factory is cached in the main registry.
Use this for backends that have heavy dependencies (peer deps, native modules).

#### Parameters

##### name

`string`

##### loader

() => `Promise`\<[`BackendFactory`](#backendfactory)\<`unknown`\>\>

#### Returns

`void`

***

### resetRegistry()

> **resetRegistry**(): `void`

Defined in: [registry.ts:77](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/registry.ts#L77)

Reset registry to initial state (for testing)

#### Returns

`void`

***

### unregisterBackend()

> **unregisterBackend**(`name`): `boolean`

Defined in: [registry.ts:58](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/registry.ts#L58)

Unregister a backend (primarily for testing)

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### zodToJsonSchema()

> **zodToJsonSchema**(`schema`): `Record`\<`string`, `unknown`\>

Defined in: [utils/schema.ts:5](https://github.com/witqq/agent-sdk/blob/v0.15.0/packages/sdk/src/utils/schema.ts#L5)

Convert a Zod schema to JSON Schema.
 Detection order: toJSONSchema() (Zod v4) → jsonSchema() (Zod v3.24+) → _def extraction (Zod v3 legacy).

#### Parameters

##### schema

`ZodType`

#### Returns

`Record`\<`string`, `unknown`\>

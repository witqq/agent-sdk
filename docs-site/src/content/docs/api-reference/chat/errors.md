---
title: "Chat Errors"
description: "Chat-specific error types"
sidebar:
  order: 24
---
# chat/errors

## Classes

### ChatError

Defined in: [chat/errors.ts:33](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L33)

Unified error class for all chat SDK errors

#### Extends

- [`AgentSDKError`](/api-reference/core/#agentsdkerror)

#### Constructors

##### Constructor

> **new ChatError**(`message`, `options`): [`ChatError`](#chaterror)

Defined in: [chat/errors.ts:39](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L39)

###### Parameters

###### message

`string`

###### options

[`ChatErrorOptions`](#chaterroroptions)

###### Returns

[`ChatError`](#chaterror)

###### Overrides

[`AgentSDKError`](/api-reference/core/#agentsdkerror).[`constructor`](/api-reference/core/#constructor-2)

#### Properties

##### code

> `readonly` **code**: [`ErrorCode`](/api-reference/core/#errorcode)

Defined in: [chat/errors.ts:34](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L34)

Machine-readable error code. Prefer values from the ErrorCode enum.

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

Defined in: [chat/errors.ts:35](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L35)

Whether this error is safe to retry

###### Overrides

[`AgentSDKError`](/api-reference/core/#agentsdkerror).[`retryable`](/api-reference/core/#retryable-2)

##### retryAfter?

> `readonly` `optional` **retryAfter**: `number`

Defined in: [chat/errors.ts:36](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L36)

##### timestamp

> `readonly` **timestamp**: `string`

Defined in: [chat/errors.ts:37](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L37)

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

***

### ExponentialBackoffStrategy

Defined in: [chat/errors.ts:253](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L253)

Exponential backoff with optional jitter

#### Implements

- [`RetryStrategy`](#retrystrategy)

#### Constructors

##### Constructor

> **new ExponentialBackoffStrategy**(`options?`): [`ExponentialBackoffStrategy`](#exponentialbackoffstrategy)

Defined in: [chat/errors.ts:259](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L259)

###### Parameters

###### options?

[`ExponentialBackoffOptions`](#exponentialbackoffoptions)

###### Returns

[`ExponentialBackoffStrategy`](#exponentialbackoffstrategy)

#### Methods

##### nextDelay()

> **nextDelay**(`attempt`, `error`): `number` \| `null`

Defined in: [chat/errors.ts:266](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L266)

Return delay in ms for the given attempt (0-based), or null to stop

###### Parameters

###### attempt

`number`

###### error

[`ChatError`](#chaterror)

###### Returns

`number` \| `null`

###### Implementation of

[`RetryStrategy`](#retrystrategy).[`nextDelay`](#nextdelay-1)

## Interfaces

### ChatErrorOptions

Defined in: [chat/errors.ts:19](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L19)

Options for constructing a ChatError

#### Properties

##### cause?

> `optional` **cause**: `unknown`

Defined in: [chat/errors.ts:27](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L27)

Original cause, if wrapping another error

##### code

> **code**: [`ErrorCode`](/api-reference/core/#errorcode)

Defined in: [chat/errors.ts:21](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L21)

Machine-readable error code

##### retryable?

> `optional` **retryable**: `boolean`

Defined in: [chat/errors.ts:23](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L23)

Whether this error is retryable (default: false)

##### retryAfter?

> `optional` **retryAfter**: `number`

Defined in: [chat/errors.ts:25](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L25)

Retry delay hint in milliseconds

***

### ExponentialBackoffOptions

Defined in: [chat/errors.ts:241](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L241)

Options for ExponentialBackoffStrategy

#### Properties

##### baseMs?

> `optional` **baseMs**: `number`

Defined in: [chat/errors.ts:243](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L243)

Base delay in ms (default: 1000)

##### jitter?

> `optional` **jitter**: `number`

Defined in: [chat/errors.ts:249](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L249)

Jitter factor 0–1 (default: 0.1)

##### maxAttempts?

> `optional` **maxAttempts**: `number`

Defined in: [chat/errors.ts:247](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L247)

Maximum number of attempts (default: 3)

##### maxMs?

> `optional` **maxMs**: `number`

Defined in: [chat/errors.ts:245](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L245)

Maximum delay in ms (default: 30000)

***

### RetryOptions

Defined in: [chat/errors.ts:284](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L284)

Options for withRetry execution

#### Properties

##### onRetry()?

> `optional` **onRetry**: (`error`, `attempt`, `delayMs`) => `void`

Defined in: [chat/errors.ts:288](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L288)

Called before each retry with the error and delay

###### Parameters

###### error

[`ChatError`](#chaterror)

###### attempt

`number`

###### delayMs

`number`

###### Returns

`void`

##### signal?

> `optional` **signal**: `AbortSignal`

Defined in: [chat/errors.ts:286](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L286)

Abort signal to cancel retries

***

### RetryStrategy

Defined in: [chat/errors.ts:235](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L235)

Strategy for computing retry delays

#### Methods

##### nextDelay()

> **nextDelay**(`attempt`, `error`): `number` \| `null`

Defined in: [chat/errors.ts:237](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L237)

Return delay in ms for the given attempt (0-based), or null to stop

###### Parameters

###### attempt

`number`

###### error

[`ChatError`](#chaterror)

###### Returns

`number` \| `null`

## Functions

### classifyError()

> **classifyError**(`error`): [`ChatError`](#chaterror)

Defined in: [chat/errors.ts:69](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L69)

Classify an unknown thrown value into a ChatError with the appropriate code.
Pattern-matches against common error shapes:
- Already a ChatError → returned as-is
- Fetch/network errors (ECONNREFUSED, ETIMEDOUT, etc.)
- HTTP status codes (401→AUTH_INVALID, 429→RATE_LIMIT, 5xx→PROVIDER_ERROR)
- Timeout patterns
- Zod validation errors
- Context overflow patterns
- Unknown → wrapped as ChatError with PROVIDER_ERROR

#### Parameters

##### error

`unknown`

The thrown value to classify

#### Returns

[`ChatError`](#chaterror)

ChatError with appropriate error code and retryable flag

***

### isRetryable()

> **isRetryable**(`error`): `boolean`

Defined in: [chat/errors.ts:337](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L337)

Type guard: check if an error is retryable

#### Parameters

##### error

`unknown`

The error to check

#### Returns

`boolean`

True if error is a retryable ChatError

***

### withRetry()

> **withRetry**\<`T`\>(`fn`, `strategy`, `options?`): `Promise`\<`T`\>

Defined in: [chat/errors.ts:302](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/errors.ts#L302)

Execute an async function with automatic retries using the provided strategy.
Respects ChatError.retryable and ChatError.retryAfter.
Classifies non-ChatError errors before deciding on retry.

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `Promise`\<`T`\>

Async function to execute

##### strategy

[`RetryStrategy`](#retrystrategy)

Retry strategy providing delay calculations

##### options?

[`RetryOptions`](#retryoptions)

Optional abort signal and retry callback

#### Returns

`Promise`\<`T`\>

Result of fn on success

#### Throws

ChatError when all retries exhausted or error is non-retryable

## References

### ErrorCode

Re-exports [ErrorCode](/api-reference/core/#errorcode)

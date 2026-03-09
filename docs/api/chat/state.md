[**@witqq/agent-sdk**](../README.md)

***

[@witqq/agent-sdk](../README.md) / chat/state

# chat/state

## Classes

### ChatAbortController

Defined in: [chat/state.ts:154](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L154)

Abort controller with external signal linking.
Wraps an AbortController and optionally links an external AbortSignal
so aborting either side cancels the operation.

#### Constructors

##### Constructor

> **new ChatAbortController**(`externalSignal?`): [`ChatAbortController`](#chatabortcontroller)

Defined in: [chat/state.ts:159](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L159)

###### Parameters

###### externalSignal?

`AbortSignal`

###### Returns

[`ChatAbortController`](#chatabortcontroller)

#### Accessors

##### isAborted

###### Get Signature

> **get** **isAborted**(): `boolean`

Defined in: [chat/state.ts:183](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L183)

Whether the operation has been aborted

###### Returns

`boolean`

##### signal

###### Get Signature

> **get** **signal**(): `AbortSignal`

Defined in: [chat/state.ts:178](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L178)

The AbortSignal for this controller

###### Returns

`AbortSignal`

#### Methods

##### abort()

> **abort**(`reason?`): `void`

Defined in: [chat/state.ts:191](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L191)

Abort the operation.

###### Parameters

###### reason?

`unknown`

Optional abort reason

###### Returns

`void`

##### dispose()

> **dispose**(): `void`

Defined in: [chat/state.ts:196](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L196)

Clean up external signal listener to prevent memory leaks

###### Returns

`void`

***

### ChatReentrancyGuard

Defined in: [chat/state.ts:119](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L119)

Guards against concurrent send() calls in a chat runtime.
acquire() before work, release() after (use try/finally).
Throws ChatError(REENTRANCY) if already acquired.

#### Constructors

##### Constructor

> **new ChatReentrancyGuard**(): [`ChatReentrancyGuard`](#chatreentrancyguard)

###### Returns

[`ChatReentrancyGuard`](#chatreentrancyguard)

#### Accessors

##### isAcquired

###### Get Signature

> **get** **isAcquired**(): `boolean`

Defined in: [chat/state.ts:123](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L123)

Whether the guard is currently held

###### Returns

`boolean`

#### Methods

##### acquire()

> **acquire**(): `void`

Defined in: [chat/state.ts:131](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L131)

Acquire the guard. Throws if already acquired.

###### Returns

`void`

###### Throws

ChatError with code REENTRANCY

##### release()

> **release**(): `void`

Defined in: [chat/state.ts:142](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L142)

Release the guard. Safe to call even if not acquired.

###### Returns

`void`

***

### StateMachine

Defined in: [chat/state.ts:21](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L21)

Generic validated state machine.
Enforces that every transition is declared in the transition map.
Throws ChatError(INVALID_TRANSITION) on illegal moves.

#### Type Parameters

##### S

`S` *extends* `string`

#### Constructors

##### Constructor

> **new StateMachine**\<`S`\>(`initial`, `transitions`): [`StateMachine`](#statemachine)\<`S`\>

Defined in: [chat/state.ts:24](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L24)

###### Parameters

###### initial

`S`

###### transitions

[`TransitionMap`](#transitionmap)\<`S`\>

###### Returns

[`StateMachine`](#statemachine)\<`S`\>

#### Properties

##### initial

> `readonly` **initial**: `S`

Defined in: [chat/state.ts:25](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L25)

##### transitions

> `readonly` **transitions**: [`TransitionMap`](#transitionmap)\<`S`\>

Defined in: [chat/state.ts:26](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L26)

#### Accessors

##### current

###### Get Signature

> **get** **current**(): `S`

Defined in: [chat/state.ts:32](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L32)

Current state

###### Returns

`S`

#### Methods

##### canTransition()

> **canTransition**(`next`): `boolean`

Defined in: [chat/state.ts:41](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L41)

Check whether transitioning to `next` is allowed from current state

###### Parameters

###### next

`S`

Target state to check

###### Returns

`boolean`

True if transition is allowed

##### reset()

> **reset**(): `void`

Defined in: [chat/state.ts:61](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L61)

Reset to initial state

###### Returns

`void`

##### transition()

> **transition**(`next`): `void`

Defined in: [chat/state.ts:50](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L50)

Transition to `next` state.

###### Parameters

###### next

`S`

###### Returns

`void`

###### Throws

ChatError(INVALID_TRANSITION) if the transition is not allowed

## Type Aliases

### TransitionMap

> **TransitionMap**\<`S`\> = `Readonly`\<`Record`\<`S`, readonly `S`[]\>\>

Defined in: [chat/state.ts:14](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L14)

Map of allowed transitions: current state → set of valid next states

#### Type Parameters

##### S

`S` *extends* `string`

## Variables

### MESSAGE\_TRANSITIONS

> `const` **MESSAGE\_TRANSITIONS**: [`TransitionMap`](#transitionmap)\<[`MessageStatus`](../chat.md#messagestatus)\>

Defined in: [chat/state.ts:77](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L77)

Allowed transitions for MessageStatus (pending → streaming → complete, etc.)

***

### RUNTIME\_TRANSITIONS

> `const` **RUNTIME\_TRANSITIONS**: [`TransitionMap`](#transitionmap)\<[`RuntimeStatus`](../chat.md#runtimestatus)\>

Defined in: [chat/state.ts:69](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L69)

Allowed transitions for RuntimeStatus (idle → streaming/disposed, etc.)

***

### TOOL\_CALL\_TRANSITIONS

> `const` **TOOL\_CALL\_TRANSITIONS**: [`TransitionMap`](#transitionmap)\<[`ToolCallStatus`](../chat.md#toolcallstatus)\>

Defined in: [chat/state.ts:86](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L86)

Allowed transitions for ToolCallStatus (pending → running → complete, etc.)

## Functions

### createMessageStateMachine()

> **createMessageStateMachine**(): [`StateMachine`](#statemachine)\<[`MessageStatus`](../chat.md#messagestatus)\>

Defined in: [chat/state.ts:103](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L103)

Create a MessageStatus state machine starting at "pending"

#### Returns

[`StateMachine`](#statemachine)\<[`MessageStatus`](../chat.md#messagestatus)\>

***

### createRuntimeStateMachine()

> **createRuntimeStateMachine**(): [`StateMachine`](#statemachine)\<[`RuntimeStatus`](../chat.md#runtimestatus)\>

Defined in: [chat/state.ts:98](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L98)

Create a RuntimeStatus state machine starting at "idle"

#### Returns

[`StateMachine`](#statemachine)\<[`RuntimeStatus`](../chat.md#runtimestatus)\>

***

### createToolCallStateMachine()

> **createToolCallStateMachine**(): [`StateMachine`](#statemachine)\<[`ToolCallStatus`](../chat.md#toolcallstatus)\>

Defined in: [chat/state.ts:108](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/state.ts#L108)

Create a ToolCallStatus state machine starting at "pending"

#### Returns

[`StateMachine`](#statemachine)\<[`ToolCallStatus`](../chat.md#toolcallstatus)\>

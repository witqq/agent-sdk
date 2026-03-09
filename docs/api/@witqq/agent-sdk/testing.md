[**@witqq/agent-sdk**](../../README.md)

***

[@witqq/agent-sdk](../../README.md) / @witqq/agent-sdk/testing

# @witqq/agent-sdk/testing

@witqq/agent-sdk/testing

Test utilities for consumers of the agent-sdk.
Provides mock factories for IAgentService, IChatRuntime, and IChatClient.

## Interfaces

### MockAgentServiceOptions

Defined in: [testing/mock-agent-service.ts:22](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-agent-service.ts#L22)

Options for createMockAgentService.

#### Properties

##### mockLLMBackend?

> `optional` **mockLLMBackend**: [`MockLLMBackendOptions`](../../backends/mock-llm.md#mockllmbackendoptions)

Defined in: [testing/mock-agent-service.ts:36](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-agent-service.ts#L36)

Opt-in: delegate to Mock LLM backend for richer simulation.
 When provided, createAgent() returns a full MockLLMAgent that participates
 in the BaseAgent lifecycle (retry, heartbeat, middleware, usage enrichment).

##### models?

> `optional` **models**: [`ModelInfo`](../../index.md#modelinfo)[]

Defined in: [testing/mock-agent-service.ts:26](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-agent-service.ts#L26)

Models to return from listModels().

##### name?

> `optional` **name**: `string`

Defined in: [testing/mock-agent-service.ts:24](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-agent-service.ts#L24)

Service name. Default: "mock".

##### onRun()?

> `optional` **onRun**: (`prompt`, `options?`) => `Promise`\<[`AgentResult`](../../index.md#agentresult)\<`void`\>\>

Defined in: [testing/mock-agent-service.ts:30](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-agent-service.ts#L30)

Custom run handler. Default: returns "Mock response".

###### Parameters

###### prompt

[`MessageContent`](../../index.md#messagecontent)

###### options?

[`RunOptions`](../../index.md#runoptions)

###### Returns

`Promise`\<[`AgentResult`](../../index.md#agentresult)\<`void`\>\>

##### onStream()?

> `optional` **onStream**: (`prompt`, `options?`) => `AsyncIterable`\<[`AgentEvent`](../../index.md#agentevent)\>

Defined in: [testing/mock-agent-service.ts:32](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-agent-service.ts#L32)

Custom stream handler. Default: yields text_delta + result events.

###### Parameters

###### prompt

[`MessageContent`](../../index.md#messagecontent)

###### options?

[`RunOptions`](../../index.md#runoptions)

###### Returns

`AsyncIterable`\<[`AgentEvent`](../../index.md#agentevent)\>

##### validationResult?

> `optional` **validationResult**: [`ValidationResult`](../../index.md#validationresult)

Defined in: [testing/mock-agent-service.ts:28](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-agent-service.ts#L28)

Custom validation result. Default: { valid: true, errors: [] }.

***

### MockChatClientOptions

Defined in: [testing/mock-chat-client.ts:14](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-chat-client.ts#L14)

Options for createMockChatClient.

#### Properties

##### models?

> `optional` **models**: [`ModelInfo`](../../index.md#modelinfo)[]

Defined in: [testing/mock-chat-client.ts:18](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-chat-client.ts#L18)

Models to return from listModels().

##### onSend()?

> `optional` **onSend**: (`sessionId`, `message`, `options?`) => `AsyncIterable`\<[`ChatEvent`](../../chat.md#chatevent)\>

Defined in: [testing/mock-chat-client.ts:22](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-chat-client.ts#L22)

Custom send handler.

###### Parameters

###### sessionId

[`ChatIdLike`](../../chat.md#chatidlike)

###### message

`string`

###### options?

[`SendMessageOptions`](../../chat.md#sendmessageoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](../../chat.md#chatevent)\>

##### providers?

> `optional` **providers**: [`ProviderConfig`](../../chat.md#providerconfig)[]

Defined in: [testing/mock-chat-client.ts:20](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-chat-client.ts#L20)

Providers to return from listProviders().

##### sessions?

> `optional` **sessions**: [`ChatSession`](../../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\>[]

Defined in: [testing/mock-chat-client.ts:16](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-chat-client.ts#L16)

Pre-seeded sessions.

***

### MockMessageOptions

Defined in: [testing/mock-data.ts:18](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-data.ts#L18)

Options for createMockMessage.

#### Properties

##### id?

> `optional` **id**: `string`

Defined in: [testing/mock-data.ts:19](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-data.ts#L19)

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [testing/mock-data.ts:24](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-data.ts#L24)

##### parts?

> `optional` **parts**: [`MessagePart`](../../chat.md#messagepart)[]

Defined in: [testing/mock-data.ts:22](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-data.ts#L22)

##### role?

> `optional` **role**: `"user"` \| `"assistant"` \| `"system"`

Defined in: [testing/mock-data.ts:20](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-data.ts#L20)

##### status?

> `optional` **status**: `"error"` \| `"streaming"` \| `"pending"` \| `"complete"`

Defined in: [testing/mock-data.ts:23](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-data.ts#L23)

##### text?

> `optional` **text**: `string`

Defined in: [testing/mock-data.ts:21](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-data.ts#L21)

***

### MockRuntimeOptions

Defined in: [testing/mock-runtime.ts:14](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-runtime.ts#L14)

Options for createMockRuntime.

#### Properties

##### defaultBackend?

> `optional` **defaultBackend**: `string`

Defined in: [testing/mock-runtime.ts:16](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-runtime.ts#L16)

Default backend name. Default: "mock".

##### defaultModel?

> `optional` **defaultModel**: `string`

Defined in: [testing/mock-runtime.ts:18](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-runtime.ts#L18)

Default model.

##### models?

> `optional` **models**: [`ModelInfo`](../../index.md#modelinfo)[]

Defined in: [testing/mock-runtime.ts:22](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-runtime.ts#L22)

Models to return from listModels().

##### onSend()?

> `optional` **onSend**: (`sessionId`, `message`, `options?`) => `AsyncIterable`\<[`ChatEvent`](../../chat.md#chatevent)\>

Defined in: [testing/mock-runtime.ts:24](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-runtime.ts#L24)

Custom send handler. When not provided, yields a single text_delta + done event.

###### Parameters

###### sessionId

[`ChatIdLike`](../../chat.md#chatidlike)

###### message

`string`

###### options?

[`RuntimeSendOptions`](../../chat.md#runtimesendoptions)

###### Returns

`AsyncIterable`\<[`ChatEvent`](../../chat.md#chatevent)\>

##### sessions?

> `optional` **sessions**: [`ChatSession`](../../chat.md#chatsession)\<`Record`\<`string`, `unknown`\>\>[]

Defined in: [testing/mock-runtime.ts:20](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-runtime.ts#L20)

Pre-seeded sessions.

***

### MockSessionOptions

Defined in: [testing/mock-data.ts:8](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-data.ts#L8)

Options for createMockSession.

#### Properties

##### config?

> `optional` **config**: `Partial`\<[`ChatSessionConfig`](../../chat.md#chatsessionconfig-1)\>

Defined in: [testing/mock-data.ts:12](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-data.ts#L12)

##### id?

> `optional` **id**: `string`

Defined in: [testing/mock-data.ts:9](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-data.ts#L9)

##### messages?

> `optional` **messages**: [`ChatMessage`](../../chat.md#chatmessage)\<`unknown`\>[]

Defined in: [testing/mock-data.ts:11](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-data.ts#L11)

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [testing/mock-data.ts:13](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-data.ts#L13)

##### status?

> `optional` **status**: `"active"`

Defined in: [testing/mock-data.ts:14](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-data.ts#L14)

##### title?

> `optional` **title**: `string`

Defined in: [testing/mock-data.ts:10](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-data.ts#L10)

## Functions

### createMockAgentService()

> **createMockAgentService**(`options?`): [`IAgentService`](../../index.md#iagentservice)

Defined in: [testing/mock-agent-service.ts:125](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-agent-service.ts#L125)

Create a mock IAgentService for testing agent-level code.

```ts
const service = createMockAgentService({ name: "test" });
const agent = service.createAgent({ model: "gpt-5-mini" });
const result = await agent.run("Hello");
```

For richer simulation with full BaseAgent lifecycle, pass `mockLLMBackend`:
```ts
const service = createMockAgentService({
  mockLLMBackend: { mode: { type: "echo" }, latency: { type: "fixed", ms: 50 } },
});
```

#### Parameters

##### options?

[`MockAgentServiceOptions`](#mockagentserviceoptions) = `{}`

#### Returns

[`IAgentService`](../../index.md#iagentservice)

***

### createMockChatClient()

> **createMockChatClient**(`options?`): [`IChatClient`](../../chat/runtime.md#ichatclient)

Defined in: [testing/mock-chat-client.ts:33](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-chat-client.ts#L33)

Create a mock IChatClient for testing React hooks that talk to RemoteChatClient.

```ts
const client = createMockChatClient({ providers: [{ id: "p1", backend: "copilot", model: "gpt-5-mini", label: "GPT Mini", createdAt: "" }] });
const providers = await client.listProviders();
```

#### Parameters

##### options?

[`MockChatClientOptions`](#mockchatclientoptions) = `{}`

#### Returns

[`IChatClient`](../../chat/runtime.md#ichatclient)

***

### createMockMessage()

> **createMockMessage**(`options?`): [`ChatMessage`](../../chat.md#chatmessage)

Defined in: [testing/mock-data.ts:64](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-data.ts#L64)

Create a mock ChatMessage for testing.

```ts
const msg = createMockMessage({ role: "user", text: "Hello" });
```

#### Parameters

##### options?

[`MockMessageOptions`](#mockmessageoptions) = `{}`

#### Returns

[`ChatMessage`](../../chat.md#chatmessage)

***

### createMockRuntime()

> **createMockRuntime**(`options?`): [`IChatRuntime`](../../chat/runtime.md#ichatruntime)

Defined in: [testing/mock-runtime.ts:35](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-runtime.ts#L35)

Create a mock IChatRuntime for testing chat UI hooks and components.

```ts
const runtime = createMockRuntime({ defaultModel: "gpt-5-mini" });
const session = await runtime.createSession({});
```

#### Parameters

##### options?

[`MockRuntimeOptions`](#mockruntimeoptions) = `{}`

#### Returns

[`IChatRuntime`](../../chat/runtime.md#ichatruntime)

***

### createMockSession()

> **createMockSession**(`options?`): [`ChatSession`](../../chat.md#chatsession)

Defined in: [testing/mock-data.ts:34](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/testing/mock-data.ts#L34)

Create a mock ChatSession for testing.

```ts
const session = createMockSession({ title: "Test chat" });
```

#### Parameters

##### options?

[`MockSessionOptions`](#mocksessionoptions) = `{}`

#### Returns

[`ChatSession`](../../chat.md#chatsession)

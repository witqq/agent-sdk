[**@witqq/agent-sdk**](../README.md)

***

[@witqq/agent-sdk](../README.md) / chat/core

# chat/core

## Interfaces

### ChatSessionMetadata

Defined in: [chat/types.ts:127](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L127)

Session metadata tracking usage statistics and custom extensions.

Updated automatically by session stores on each `addMessage()` call.
The generic `TCustom` parameter allows type-safe application-specific
metadata via the `custom` field.

#### Type Parameters

##### TCustom

`TCustom` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

Shape of the `custom` field (defaults to `Record<string, unknown>`)

#### Properties

##### custom?

> `optional` **custom**: `TCustom`

Defined in: [chat/types.ts:135](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L135)

Application-specific metadata — typed via the TCustom generic parameter

##### messageCount

> **messageCount**: `number`

Defined in: [chat/types.ts:129](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L129)

Number of messages in the session (updated by session store)

##### tags?

> `optional` **tags**: `string`[]

Defined in: [chat/types.ts:133](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L133)

Optional tags for session categorization and filtering

##### totalTokens

> **totalTokens**: `number`

Defined in: [chat/types.ts:131](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/types.ts#L131)

Total token count across all messages in the session

## Functions

### chatEventToAgentEvent()

> **chatEventToAgentEvent**(`event`): [`AgentEvent`](../index.md#agentevent) \| `null`

Defined in: [chat/bridge.ts:101](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/bridge.ts#L101)

Map a ChatEvent back to an AgentEvent for accumulator consumption.
Returns null for events that don't map to accumulator-relevant AgentEvents.

#### Parameters

##### event

[`ChatEvent`](../chat.md#chatevent)

#### Returns

[`AgentEvent`](../index.md#agentevent) \| `null`

***

### extractToolResults()

> **extractToolResults**(`message`): [`ToolResult`](../index.md#toolresult)[]

Defined in: [chat/conversion.ts:121](https://github.com/witqq/agent-sdk/blob/9c35a744eddf302d0f5c55e9a88e8708805c4db4/packages/sdk/src/chat/conversion.ts#L121)

Extract ToolResults from ToolCallParts that have results

#### Parameters

##### message

[`ChatMessage`](../chat.md#chatmessage)

#### Returns

[`ToolResult`](../index.md#toolresult)[]

## References

### adaptAgentEvents

Re-exports [adaptAgentEvents](../chat.md#adaptagentevents)

***

### agentEventToChatEvent

Re-exports [agentEventToChatEvent](../chat.md#agenteventtochatevent)

***

### ChatEvent

Re-exports [ChatEvent](../chat.md#chatevent)

***

### ChatEventType

Re-exports [ChatEventType](../chat.md#chateventtype)

***

### ChatId

Re-exports [ChatId](../chat.md#chatid)

***

### ChatIdLike

Re-exports [ChatIdLike](../chat.md#chatidlike)

***

### ChatMessage

Re-exports [ChatMessage](../chat.md#chatmessage)

***

### ChatMessageMetadata

Re-exports [ChatMessageMetadata](../chat.md#chatmessagemetadata-1)

***

### ChatMessageStatus

Re-exports [ChatMessageStatus](../chat.md#chatmessagestatus-1)

***

### ChatMiddleware

Re-exports [ChatMiddleware](../chat.md#chatmiddleware)

***

### ChatMiddlewareContext

Re-exports [ChatMiddlewareContext](../chat.md#chatmiddlewarecontext)

***

### ChatRole

Re-exports [ChatRole](../chat.md#chatrole)

***

### ChatSession

Re-exports [ChatSession](../chat.md#chatsession)

***

### ChatSessionConfig

Re-exports [ChatSessionConfig](../chat.md#chatsessionconfig-1)

***

### createChatId

Re-exports [createChatId](../chat.md#createchatid)

***

### createTextMessage

Re-exports [createTextMessage](../chat.md#createtextmessage)

***

### FilePart

Re-exports [FilePart](../chat.md#filepart)

***

### fromAgentMessage

Re-exports [fromAgentMessage](../chat.md#fromagentmessage)

***

### getMessageReasoning

Re-exports [getMessageReasoning](../chat.md#getmessagereasoning)

***

### getMessageText

Re-exports [getMessageText](../chat.md#getmessagetext)

***

### getMessageToolCalls

Re-exports [getMessageToolCalls](../chat.md#getmessagetoolcalls)

***

### IChatProvider

Re-exports [IChatProvider](../chat.md#ichatprovider)

***

### isChatEvent

Re-exports [isChatEvent](../chat.md#ischatevent)

***

### isChatMessage

Re-exports [isChatMessage](../chat.md#ischatmessage)

***

### isChatSession

Re-exports [isChatSession](../chat.md#ischatsession)

***

### isFilePart

Re-exports [isFilePart](../chat.md#isfilepart)

***

### isMessagePart

Re-exports [isMessagePart](../chat.md#ismessagepart)

***

### isObservableSession

Re-exports [isObservableSession](../chat.md#isobservablesession)

***

### isReasoningPart

Re-exports [isReasoningPart](../chat.md#isreasoningpart)

***

### isSourcePart

Re-exports [isSourcePart](../chat.md#issourcepart)

***

### isTextPart

Re-exports [isTextPart](../chat.md#istextpart)

***

### isToolCallPart

Re-exports [isToolCallPart](../chat.md#istoolcallpart)

***

### MessagePart

Re-exports [MessagePart](../chat.md#messagepart)

***

### MessageStatus

Re-exports [MessageStatus](../chat.md#messagestatus)

***

### ObservableSession

Re-exports [ObservableSession](../chat.md#observablesession)

***

### PartStatus

Re-exports [PartStatus](../chat.md#partstatus)

***

### ReasoningPart

Re-exports [ReasoningPart](../chat.md#reasoningpart)

***

### RuntimeSendOptions

Re-exports [RuntimeSendOptions](../chat.md#runtimesendoptions)

***

### RuntimeStatus

Re-exports [RuntimeStatus](../chat.md#runtimestatus)

***

### SendMessageOptions

Re-exports [SendMessageOptions](../chat.md#sendmessageoptions)

***

### SessionInfo

Re-exports [SessionInfo](../chat.md#sessioninfo)

***

### SessionStatus

Re-exports [SessionStatus](../chat.md#sessionstatus)

***

### SourcePart

Re-exports [SourcePart](../chat.md#sourcepart)

***

### TextPart

Re-exports [TextPart](../chat.md#textpart)

***

### toAgentMessage

Re-exports [toAgentMessage](../chat.md#toagentmessage)

***

### toAgentMessages

Re-exports [toAgentMessages](../chat.md#toagentmessages)

***

### toChatId

Re-exports [toChatId](../chat.md#tochatid)

***

### ToolCallPart

Re-exports [ToolCallPart](../chat.md#toolcallpart)

***

### ToolCallStatus

Re-exports [ToolCallStatus](../chat.md#toolcallstatus)

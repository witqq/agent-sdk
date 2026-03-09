---
title: "Chat Core"
description: "Core chat types — messages, sessions, options"
sidebar:
  order: 21
---
# chat/core

## Interfaces

### ChatSessionMetadata

Defined in: [chat/types.ts:127](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/types.ts#L127)

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

Defined in: [chat/types.ts:135](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/types.ts#L135)

Application-specific metadata — typed via the TCustom generic parameter

##### messageCount

> **messageCount**: `number`

Defined in: [chat/types.ts:129](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/types.ts#L129)

Number of messages in the session (updated by session store)

##### tags?

> `optional` **tags**: `string`[]

Defined in: [chat/types.ts:133](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/types.ts#L133)

Optional tags for session categorization and filtering

##### totalTokens

> **totalTokens**: `number`

Defined in: [chat/types.ts:131](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/types.ts#L131)

Total token count across all messages in the session

## Functions

### chatEventToAgentEvent()

> **chatEventToAgentEvent**(`event`): [`AgentEvent`](/api-reference/core/#agentevent) \| `null`

Defined in: [chat/bridge.ts:100](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/bridge.ts#L100)

Map a ChatEvent back to an AgentEvent for accumulator consumption.
Returns null for events that don't map to accumulator-relevant AgentEvents.

#### Parameters

##### event

[`ChatEvent`](/api-reference/chat/index-exports/#chatevent)

#### Returns

[`AgentEvent`](/api-reference/core/#agentevent) \| `null`

***

### extractToolResults()

> **extractToolResults**(`message`): [`ToolResult`](/api-reference/core/#toolresult)[]

Defined in: [chat/conversion.ts:121](https://github.com/witqq/agent-sdk/blob/a3a33c506030d199a873e1542b88b1301a64ddf0/src/chat/conversion.ts#L121)

Extract ToolResults from ToolCallParts that have results

#### Parameters

##### message

[`ChatMessage`](/api-reference/chat/index-exports/#chatmessage)

#### Returns

[`ToolResult`](/api-reference/core/#toolresult)[]

## References

### adaptAgentEvents

Re-exports [adaptAgentEvents](/api-reference/chat/index-exports/#adaptagentevents)

***

### agentEventToChatEvent

Re-exports [agentEventToChatEvent](/api-reference/chat/index-exports/#agenteventtochatevent)

***

### ChatEvent

Re-exports [ChatEvent](/api-reference/chat/index-exports/#chatevent)

***

### ChatEventType

Re-exports [ChatEventType](/api-reference/chat/index-exports/#chateventtype)

***

### ChatId

Re-exports [ChatId](/api-reference/chat/index-exports/#chatid)

***

### ChatIdLike

Re-exports [ChatIdLike](/api-reference/chat/index-exports/#chatidlike)

***

### ChatMessage

Re-exports [ChatMessage](/api-reference/chat/index-exports/#chatmessage)

***

### ChatMessageMetadata

Re-exports [ChatMessageMetadata](/api-reference/chat/index-exports/#chatmessagemetadata-1)

***

### ChatMessageStatus

Re-exports [ChatMessageStatus](/api-reference/chat/index-exports/#chatmessagestatus-1)

***

### ChatMiddleware

Re-exports [ChatMiddleware](/api-reference/chat/index-exports/#chatmiddleware)

***

### ChatMiddlewareContext

Re-exports [ChatMiddlewareContext](/api-reference/chat/index-exports/#chatmiddlewarecontext)

***

### ChatRole

Re-exports [ChatRole](/api-reference/chat/index-exports/#chatrole)

***

### ChatSession

Re-exports [ChatSession](/api-reference/chat/index-exports/#chatsession)

***

### ChatSessionConfig

Re-exports [ChatSessionConfig](/api-reference/chat/index-exports/#chatsessionconfig-1)

***

### createChatId

Re-exports [createChatId](/api-reference/chat/index-exports/#createchatid)

***

### createTextMessage

Re-exports [createTextMessage](/api-reference/chat/index-exports/#createtextmessage)

***

### FilePart

Re-exports [FilePart](/api-reference/chat/index-exports/#filepart)

***

### fromAgentMessage

Re-exports [fromAgentMessage](/api-reference/chat/index-exports/#fromagentmessage)

***

### getMessageReasoning

Re-exports [getMessageReasoning](/api-reference/chat/index-exports/#getmessagereasoning)

***

### getMessageText

Re-exports [getMessageText](/api-reference/chat/index-exports/#getmessagetext)

***

### getMessageToolCalls

Re-exports [getMessageToolCalls](/api-reference/chat/index-exports/#getmessagetoolcalls)

***

### IChatProvider

Re-exports [IChatProvider](/api-reference/chat/index-exports/#ichatprovider)

***

### isChatEvent

Re-exports [isChatEvent](/api-reference/chat/index-exports/#ischatevent)

***

### isChatMessage

Re-exports [isChatMessage](/api-reference/chat/index-exports/#ischatmessage)

***

### isChatSession

Re-exports [isChatSession](/api-reference/chat/index-exports/#ischatsession)

***

### isFilePart

Re-exports [isFilePart](/api-reference/chat/index-exports/#isfilepart)

***

### isMessagePart

Re-exports [isMessagePart](/api-reference/chat/index-exports/#ismessagepart)

***

### isObservableSession

Re-exports [isObservableSession](/api-reference/chat/index-exports/#isobservablesession)

***

### isReasoningPart

Re-exports [isReasoningPart](/api-reference/chat/index-exports/#isreasoningpart)

***

### isSourcePart

Re-exports [isSourcePart](/api-reference/chat/index-exports/#issourcepart)

***

### isTextPart

Re-exports [isTextPart](/api-reference/chat/index-exports/#istextpart)

***

### isToolCallPart

Re-exports [isToolCallPart](/api-reference/chat/index-exports/#istoolcallpart)

***

### MessagePart

Re-exports [MessagePart](/api-reference/chat/index-exports/#messagepart)

***

### MessageStatus

Re-exports [MessageStatus](/api-reference/chat/index-exports/#messagestatus)

***

### ObservableSession

Re-exports [ObservableSession](/api-reference/chat/index-exports/#observablesession)

***

### PartStatus

Re-exports [PartStatus](/api-reference/chat/index-exports/#partstatus)

***

### ReasoningPart

Re-exports [ReasoningPart](/api-reference/chat/index-exports/#reasoningpart)

***

### RuntimeSendOptions

Re-exports [RuntimeSendOptions](/api-reference/chat/index-exports/#runtimesendoptions)

***

### RuntimeStatus

Re-exports [RuntimeStatus](/api-reference/chat/index-exports/#runtimestatus)

***

### SendMessageOptions

Re-exports [SendMessageOptions](/api-reference/chat/index-exports/#sendmessageoptions)

***

### SessionInfo

Re-exports [SessionInfo](/api-reference/chat/index-exports/#sessioninfo)

***

### SessionStatus

Re-exports [SessionStatus](/api-reference/chat/index-exports/#sessionstatus)

***

### SourcePart

Re-exports [SourcePart](/api-reference/chat/index-exports/#sourcepart)

***

### TextPart

Re-exports [TextPart](/api-reference/chat/index-exports/#textpart)

***

### toAgentMessage

Re-exports [toAgentMessage](/api-reference/chat/index-exports/#toagentmessage)

***

### toAgentMessages

Re-exports [toAgentMessages](/api-reference/chat/index-exports/#toagentmessages)

***

### toChatId

Re-exports [toChatId](/api-reference/chat/index-exports/#tochatid)

***

### ToolCallPart

Re-exports [ToolCallPart](/api-reference/chat/index-exports/#toolcallpart)

***

### ToolCallStatus

Re-exports [ToolCallStatus](/api-reference/chat/index-exports/#toolcallstatus)

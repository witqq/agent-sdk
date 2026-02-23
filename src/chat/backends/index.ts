/**
 * @witqq/agent-sdk/chat/backends
 *
 * Backend adapters barrel — re-exports types, base class, and concrete adapters.
 */

export type {
  IBackendAdapter,
  BackendAdapterOptions,
} from "./types.js";

export { BaseBackendAdapter } from "./base.js";

export {
  CopilotChatAdapter,
  type CopilotChatAdapterOptions,
} from "./copilot.js";

export {
  ClaudeChatAdapter,
  type ClaudeChatAdapterOptions,
} from "./claude.js";

export {
  VercelAIChatAdapter,
  type VercelAIChatAdapterOptions,
} from "./vercel-ai.js";

export type { IChatTransport, WritableResponse, CloseDetectable, SSETransportOptions } from "./transport.js";
export { SSEChatTransport, streamToTransport } from "./transport.js";

export type { WebSocketLike, WsTransportOptions } from "./ws-transport.js";
export { WsChatTransport, WS_READY_STATE } from "./ws-transport.js";

export { InProcessChatTransport } from "./in-process-transport.js";

export type { TransportInterceptor, InterceptorContext } from "./interceptors.js";
export { withInterceptors } from "./interceptors.js";

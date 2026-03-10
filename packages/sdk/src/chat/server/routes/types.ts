/**
 * Shared types for route modules.
 */

import type { IChatRuntime } from "../../runtime.js";
import type { ChatServerHooks, TransportFactory, ReadableRequest } from "../handler.js";
import type { WritableResponse } from "../../backends/transport.js";
import type { IProviderStore } from "../provider-store.js";
import type { ITokenStore } from "../token-store.js";

/**
 * Handler state — intentionally empty after stateless refactor (STAT-01).
 * Preserved as a type for backward compatibility with custom route modules.
 * Model resolution is now fully per-request via resolveRequestContext.
 * @deprecated Will be removed in next major version.
 */
export interface HandlerState {
  /** @deprecated Model is now resolved per-request. This field is never set. */
  currentModel?: string | undefined;
}

/**
 * Shared context passed to every route module.
 */
export interface RouteContext {
  readonly runtime: IChatRuntime;
  readonly maxBodySize: number;
  readonly heartbeatMs?: number;
  readonly hooks?: ChatServerHooks;
  readonly providerStore?: IProviderStore;
  readonly tokenStore?: ITokenStore;
  readonly transportFactory?: TransportFactory;
  readonly state: HandlerState;
}

/**
 * A route module handler.
 * Returns `true` if the request was handled, `false` to try next module.
 */
export type RouteHandler = (
  method: string,
  path: string,
  req: ReadableRequest,
  res: WritableResponse,
  ctx: RouteContext,
) => Promise<boolean>;

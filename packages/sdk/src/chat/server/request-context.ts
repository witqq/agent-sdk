/**
 * Request context resolution — per-request credential + model lookup.
 *
 * Resolves a providerId into a RequestContext containing backend name,
 * credentials (AuthToken), and model identifier. This enables stateless
 * request handling where each request carries its own context.
 *
 * @example
 * ```ts
 * const ctx = await resolveRequestContext("my-copilot-provider", {
 *   providerStore,
 *   tokenStore,
 * });
 * // ctx = { backend: "copilot", credentials: { accessToken: "..." }, model: "gpt-5-mini" }
 * ```
 */

import type { AuthToken } from "../../auth/types.js";
import type { IProviderStore, ProviderConfig } from "../provider-types.js";
import type { ITokenStore } from "./token-store.js";
import { ChatError } from "../errors.js";
import { ErrorCode } from "../../types/errors.js";

// ─── Types ─────────────────────────────────────────────────────

/** Per-request context carrying backend, credentials, and model */
export interface RequestContext {
  /** Backend name (e.g. "copilot", "claude", "vercel-ai") */
  backend: string;
  /** Resolved authentication token */
  credentials: AuthToken;
  /** Model identifier from provider config */
  model: string;
  /** Original provider config for reference */
  provider: ProviderConfig;
}

/** Dependencies for context resolution */
export interface RequestContextDeps {
  /** Provider store to look up provider config */
  providerStore: IProviderStore;
  /** Token store to load credentials for the backend */
  tokenStore: ITokenStore;
}

// ─── Resolution ────────────────────────────────────────────────

/**
 * Resolve a providerId into a full RequestContext.
 *
 * Flow: providerId → ProviderConfig (from providerStore) → AuthToken (from tokenStore) → RequestContext
 *
 * @throws ChatError with PROVIDER_NOT_FOUND if provider doesn't exist
 * @throws ChatError with AUTH_REQUIRED if no token found for the provider's backend
 */
export async function resolveRequestContext(
  providerId: string,
  deps: RequestContextDeps,
): Promise<RequestContext> {
  // Step 1: Look up provider config
  const provider = await deps.providerStore.get(providerId);
  if (!provider) {
    throw new ChatError(`Provider "${providerId}" not found`, {
      code: ErrorCode.PROVIDER_NOT_FOUND,
    });
  }

  // Step 2: Load credentials for the backend
  const credentials = await deps.tokenStore.load(provider.backend);
  if (!credentials) {
    throw new ChatError(
      `Authentication required for backend "${provider.backend}"`,
      {
        code: ErrorCode.AUTH_REQUIRED,
      },
    );
  }

  return {
    backend: provider.backend,
    credentials,
    model: provider.model,
    provider,
  };
}

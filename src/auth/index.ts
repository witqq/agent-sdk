// ─── Auth Types ────────────────────────────────────────────────
export type {
  AuthToken,
  CopilotAuthToken,
  ClaudeAuthToken,
  DeviceFlowResult,
  OAuthFlowOptions,
  OAuthFlowResult,
} from "./types.js";

export {
  AuthError,
  DeviceCodeExpiredError,
  AccessDeniedError,
  TokenExchangeError,
} from "./types.js";

// ─── Auth Providers ────────────────────────────────────────────
export { CopilotAuth } from "./copilot-auth.js";
export { ClaudeAuth } from "./claude-auth.js";

// ─── Token Refresh ─────────────────────────────────────────────
export { TokenRefreshManager } from "./refresh-manager.js";
export type { TokenRefreshOptions, TokenRefreshEvents } from "./refresh-manager.js";

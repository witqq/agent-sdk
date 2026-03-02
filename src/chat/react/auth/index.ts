/**
 * Per-backend auth form components and hooks.
 *
 * Each backend exports its own auth form component and hook, co-located with the
 * backend's authentication logic. ProviderSettings dynamically renders
 * the appropriate form based on the selected backend.
 */
export { CopilotAuthForm } from "./CopilotAuthForm.js";
export { ClaudeAuthForm } from "./ClaudeAuthForm.js";
export { VercelAIAuthForm } from "./VercelAIAuthForm.js";
export type { AuthFormProps, AuthFormComponent } from "./types.js";
export { useCopilotAuth } from "./useCopilotAuth.js";
export type { UseCopilotAuthOptions, UseCopilotAuthReturn } from "./useCopilotAuth.js";
export { useClaudeAuth } from "./useClaudeAuth.js";
export type { UseClaudeAuthOptions, UseClaudeAuthReturn } from "./useClaudeAuth.js";
export { useApiKeyAuth } from "./useApiKeyAuth.js";
export type { UseApiKeyAuthOptions, UseApiKeyAuthReturn } from "./useApiKeyAuth.js";

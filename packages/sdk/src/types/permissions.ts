/** Scope for "remember this decision" */
export type PermissionScope = "once" | "session" | "project" | "always";

/** What the permission callback receives */
export interface PermissionRequest {
  toolName: string;
  toolArgs: Record<string, unknown>;
  /** Unique identifier for this specific tool call */
  toolCallId?: string;
  /** SDK-suggested scope (from Claude CLI's suggestions) */
  suggestedScope?: PermissionScope;
  /** Original SDK permission request (for pass-through) */
  rawSDKRequest?: unknown;
}

/** What the permission callback returns */
export interface PermissionDecision {
  allowed: boolean;
  /** How long to remember this decision */
  scope?: PermissionScope;
  /** Modified tool arguments (tool args may be altered by user) */
  modifiedInput?: Record<string, unknown>;
  /** Denial reason (if denied) */
  reason?: string;
}

/** Permission callback signature */
export type PermissionCallback = (
  request: PermissionRequest,
  signal: AbortSignal,
) => Promise<PermissionDecision>;

/** Request for user input — separate from permissions */
export interface UserInputRequest {
  question: string;
  choices?: string[];
  /** Whether to allow freeform text input (default: true) */
  allowFreeform?: boolean;
}

/** Response from user to an input request */
export interface UserInputResponse {
  answer: string;
  /** true if user typed a custom answer instead of selecting a choice */
  wasFreeform: boolean;
  /** Index of selected choice (if choice was selected) */
  selectedChoiceIndex?: number;
}

/** Hooks for supervisor/UI to intercept agent actions */
export interface SupervisorHooks {
  onPermission?: PermissionCallback;
  onAskUser?: (
    request: UserInputRequest,
    signal: AbortSignal,
  ) => Promise<UserInputResponse>;
}

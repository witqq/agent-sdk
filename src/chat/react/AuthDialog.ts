import {
  createElement,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "./useAuth.js";
import type { AuthBackend, AuthStatus } from "./useAuth.js";
import type { AuthToken } from "../../auth/index.js";

/** Props for the AuthDialog component. */
export interface AuthDialogProps {
  backends: AuthBackend[];
  selectedBackend?: AuthBackend;
  onBackendChange?: (backend: AuthBackend) => void;
  onAuthenticated?: (token: AuthToken) => void;
  renderCopilotFlow?: (state: {
    deviceCode: string;
    verificationUrl: string;
    status: AuthStatus;
  }) => ReactNode;
  renderClaudeFlow?: (state: {
    authorizeUrl: string | null;
    status: AuthStatus;
    completeOAuth: (code: string) => Promise<void>;
  }) => ReactNode;
  renderApiKeyFlow?: (state: {
    submitApiKey: (key: string) => void;
    status: AuthStatus;
  }) => ReactNode;
  className?: string;
}

/**
 * Multi-backend auth dialog component.
 *
 * Headless component that renders backend selector buttons and
 * per-backend auth flows. Uses data attributes for styling hooks.
 * Supports custom render props for each flow type.
 */
export function AuthDialog({
  backends,
  selectedBackend: controlledBackend,
  onBackendChange,
  onAuthenticated,
  renderCopilotFlow,
  renderClaudeFlow,
  renderApiKeyFlow,
  className,
}: AuthDialogProps): ReactNode {
  const [internalBackend, setInternalBackend] = useState<AuthBackend>(
    controlledBackend ?? backends[0] ?? "copilot",
  );

  const activeBackend = controlledBackend ?? internalBackend;

  const handleBackendChange = useCallback(
    (backend: AuthBackend) => {
      setInternalBackend(backend);
      onBackendChange?.(backend);
    },
    [onBackendChange],
  );

  const auth = useAuth({ backend: activeBackend, onAuthenticated });

  const children: ReactNode[] = [];

  // Backend selector buttons
  const selectorButtons = backends.map((backend) =>
    createElement(
      "button",
      {
        key: backend,
        type: "button",
        "data-auth-backend": backend,
        "data-auth-selected": String(backend === activeBackend),
        onClick: () => handleBackendChange(backend),
      },
      backend,
    ),
  );

  children.push(
    createElement(
      "div",
      { key: "selector", "data-auth-selector": "true" },
      ...selectorButtons,
    ),
  );

  // Status and error attributes
  const contentAttrs: Record<string, unknown> = {
    key: "content",
    "data-auth-content": "true",
    "data-auth-status": auth.status,
  };
  if (auth.error) {
    contentAttrs["data-auth-error"] = auth.error.message;
  }

  // Per-backend content
  let flowContent: ReactNode = null;

  if (activeBackend === "copilot") {
    if (
      renderCopilotFlow &&
      auth.deviceCode &&
      auth.verificationUrl
    ) {
      flowContent = renderCopilotFlow({
        deviceCode: auth.deviceCode,
        verificationUrl: auth.verificationUrl,
        status: auth.status,
      });
    } else {
      const copilotChildren: ReactNode[] = [];
      if (auth.status === "idle") {
        copilotChildren.push(
          createElement(
            "button",
            {
              key: "start",
              type: "button",
              "data-action": "start-device-flow",
              onClick: auth.startDeviceFlow,
            },
            "Start Device Flow",
          ),
        );
      }
      if (auth.deviceCode && auth.verificationUrl) {
        copilotChildren.push(
          createElement("span", { key: "code", "data-device-code": "true" }, auth.deviceCode),
        );
        copilotChildren.push(
          createElement("a", { key: "url", "data-verification-url": "true", href: auth.verificationUrl }, auth.verificationUrl),
        );
      }
      if (auth.status === "pending") {
        copilotChildren.push(
          createElement("span", { key: "loading", "data-auth-loading": "true" }, "Waiting..."),
        );
      }
      flowContent = createElement(
        "div",
        { "data-auth-flow": "copilot" },
        ...copilotChildren,
      );
    }
  } else if (activeBackend === "claude") {
    if (renderClaudeFlow) {
      flowContent = renderClaudeFlow({
        authorizeUrl: auth.authorizeUrl,
        status: auth.status,
        completeOAuth: auth.completeOAuth,
      });
    } else {
      const claudeChildren: ReactNode[] = [];
      if (auth.status === "idle") {
        claudeChildren.push(
          createElement(
            "button",
            {
              key: "start",
              type: "button",
              "data-action": "start-oauth-flow",
              onClick: auth.startOAuthFlow,
            },
            "Start OAuth Flow",
          ),
        );
      }
      if (auth.authorizeUrl) {
        claudeChildren.push(
          createElement("a", { key: "url", "data-authorize-url": "true", href: auth.authorizeUrl }, auth.authorizeUrl),
        );
      }
      flowContent = createElement(
        "div",
        { "data-auth-flow": "claude" },
        ...claudeChildren,
      );
    }
  } else if (activeBackend === "api-key") {
    if (renderApiKeyFlow) {
      flowContent = renderApiKeyFlow({
        submitApiKey: auth.submitApiKey,
        status: auth.status,
      });
    } else {
      flowContent = createElement(
        "div",
        { "data-auth-flow": "api-key" },
        createElement(
          "button",
          {
            key: "submit",
            type: "button",
            "data-action": "submit-api-key",
            onClick: () => auth.submitApiKey(""),
          },
          "Submit API Key",
        ),
      );
    }
  }

  children.push(createElement("div", contentAttrs, flowContent));

  // Error display
  if (auth.error) {
    children.push(
      createElement(
        "div",
        { key: "error", "data-auth-error-display": "true" },
        auth.error.message,
      ),
    );
  }

  return createElement(
    "div",
    { "data-auth-dialog": "true", className },
    ...children,
  );
}

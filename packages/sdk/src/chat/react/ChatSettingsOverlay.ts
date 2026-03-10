/**
 * @witqq/agent-sdk/chat/react — ChatSettingsOverlay
 *
 * Modal overlay for provider settings management.
 * Features: backdrop click-to-close, ESC key handler, focus trap.
 */

import { createElement, useState, useEffect, useRef, useCallback, type ReactNode, type ComponentType } from "react";
import { ProviderSettings, type ProviderSettingsProps } from "./ProviderSettings.js";
import type { ProviderConfig } from "../provider-types.js";

/** Props for the ChatSettingsOverlay component. */
export interface ChatSettingsOverlayProps {
  /** Whether the overlay is visible. */
  open: boolean;
  /** Close handler. */
  onClose: () => void;
  /** Available providers. */
  providers?: ProviderConfig[];
  /** Auth API base URL. */
  authBaseUrl?: string;
  /** Provider created handler. */
  onProviderCreated?: (provider: { backend: string; model: string; label?: string }) => void;
  /** Provider deleted handler. */
  onProviderDeleted?: (id: string) => void;
  /** Provider updated handler. */
  onProviderUpdated?: (id: string, changes: Partial<ProviderConfig>) => void;
  /** Called when authentication succeeds. Parent should refresh providers. */
  onAuthCompleted?: (backend: string) => void;
  /** Slot override for ProviderSettings. */
  ProviderSettingsComponent?: ComponentType<ProviderSettingsProps>;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const CLOSE_ANIMATION_MS = 150;

/**
 * Settings modal — renders `[data-provider-settings-overlay]` when open.
 * Returns null when closed.
 * Backdrop click and Escape key close the overlay with exit animation.
 * Focus is trapped within the overlay content.
 */
export function ChatSettingsOverlay({
  open,
  onClose,
  providers = [],
  authBaseUrl,
  onProviderCreated,
  onProviderDeleted,
  onProviderUpdated,
  onAuthCompleted,
  ProviderSettingsComponent: PSC = ProviderSettings,
}: ChatSettingsOverlayProps): ReactNode {
  const [isClosing, setIsClosing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, CLOSE_ANIMATION_MS);
  }, [onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      handleClose();
      return;
    }
    if (e.key === "Tab" && contentRef.current) {
      const focusable = Array.from(contentRef.current.querySelectorAll(FOCUSABLE)) as HTMLElement[];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [handleClose]);

  const handleBackdropClick = useCallback((e: { target: unknown; currentTarget: unknown }) => {
    if (e.target === e.currentTarget) handleClose();
  }, [handleClose]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement;
    document.addEventListener("keydown", handleKeyDown);
    const timer = setTimeout(() => {
      if (contentRef.current) {
        const first = contentRef.current.querySelector(FOCUSABLE) as HTMLElement | null;
        if (first) first.focus();
      }
    }, 50);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
      const prev = previousFocusRef.current as HTMLElement | null;
      if (prev && typeof prev.focus === "function") prev.focus();
    };
  }, [open, handleKeyDown]);

  if (!open && !isClosing) return null;

  return createElement("div", {
      "data-provider-settings-overlay": "true",
      "data-closing": isClosing ? "true" : undefined,
      onClick: handleBackdropClick,
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Provider settings",
    },
    createElement("div", {
        ref: contentRef,
        "data-provider-settings-content": "true",
        "data-closing": isClosing ? "true" : undefined,
      },
      createElement(PSC, {
        providers,
        authBaseUrl,
        onClose: handleClose,
        onProviderCreated: onProviderCreated ?? undefined,
        onProviderDeleted: onProviderDeleted ?? undefined,
        onProviderUpdated: onProviderUpdated ?? undefined,
        onAuthCompleted: onAuthCompleted ?? undefined,
      }),
    ),
  );
}

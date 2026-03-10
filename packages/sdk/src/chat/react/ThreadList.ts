import { createElement, useCallback, useMemo, type ReactNode } from "react";
import type { SessionInfo, ChatSession } from "../core.js";

/** A session item that ThreadList can display — either full ChatSession or lightweight SessionInfo. */
type SessionItem = SessionInfo | ChatSession;

/** Type guard: checks if item has `messages` array (ChatSession) vs `messageCount` (SessionInfo). */
function isFullSession(item: SessionItem): item is ChatSession {
  return "messages" in item && Array.isArray((item as ChatSession).messages);
}

/** Format a Date to a short relative time string (e.g. "2m", "3h", "5d"). */
function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

/** Normalize any session item to SessionInfo for display. */
function normalizeSession(item: SessionItem): SessionInfo {
  if (isFullSession(item)) {
    return {
      id: item.id,
      title: item.title,
      status: item.status,
      messageCount: item.metadata?.messageCount ?? item.messages.length,
      lastMessage: item.messages[item.messages.length - 1],
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
  return item;
}

/** Props for the ThreadList component. */
export interface ThreadListProps {
  sessions: SessionItem[];
  activeSessionId?: string;
  onSelect: (id: string) => void;
  onCreate?: () => void;
  onDelete?: (id: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  className?: string;
}

/**
 * Session sidebar component for listing, searching, creating, and deleting sessions.
 */
export function ThreadList({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onDelete,
  searchQuery,
  onSearchChange,
  className,
}: ThreadListProps): ReactNode {
  const handleSearchChange = useCallback(
    (e: Event) => {
      onSearchChange?.((e.target as HTMLInputElement).value);
    },
    [onSearchChange],
  );

  const normalized = useMemo(() => sessions.map(normalizeSession), [sessions]);

  const filtered = useMemo(() => {
    if (!searchQuery) return normalized;
    const q = searchQuery.toLowerCase();
    return normalized.filter((s) => (s.title ?? "").toLowerCase().includes(q));
  }, [normalized, searchQuery]);

  const children: ReactNode[] = [];

  // Header with search + create button
  children.push(
    createElement("div", { key: "header", "data-thread-list-header": "true" },
      createElement("input", {
        "data-thread-list-search": "true",
        value: searchQuery ?? "",
        onChange: handleSearchChange,
        placeholder: "Search...",
      }),
      createElement(
        "button",
        {
          "data-action": "create-session",
          onClick: onCreate,
          type: "button",
        },
        "+",
      ),
    ),
  );

  // Session items
  const items = filtered.map((session) => {
    const isActive = session.id === activeSessionId;
    const itemChildren: ReactNode[] = [
      createElement("span", { key: "title", "data-session-title": "true" }, session.title ?? "Untitled"),
    ];

    if (session.updatedAt) {
      const timeStr = formatRelativeTime(new Date(session.updatedAt));
      itemChildren.push(
        createElement("span", { key: "time", "data-session-time": "true" }, timeStr),
      );
    }

    if (onDelete) {
      itemChildren.push(
        createElement(
          "button",
          {
            key: "delete",
            "data-action": "delete-session",
            onClick: (e: MouseEvent) => {
              e.stopPropagation();
              onDelete(session.id);
            },
            type: "button",
          },
          "×",
        ),
      );
    }

    return createElement(
      "div",
      {
        key: session.id,
        "data-session-item": "true",
        "data-session-active": isActive ? "true" : "false",
        "data-session-status": session.status ?? "active",
        onClick: () => onSelect(session.id),
      },
      ...itemChildren,
    );
  });

  children.push(
    createElement(
      "div",
      { key: "items", "data-thread-list-items": "true" },
      ...items,
    ),
  );

  return createElement(
    "div",
    { "data-thread-list": "true", className },
    ...children,
  );
}

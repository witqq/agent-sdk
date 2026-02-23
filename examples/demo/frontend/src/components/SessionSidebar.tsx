import { useCallback } from "react";
import { Plus, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThreadList, useChatRuntime, useSessions } from "@witqq/agent-sdk/chat/react";

interface SessionSidebarProps {
  open: boolean;
  onToggle: () => void;
}

export function SessionSidebar({ open, onToggle }: SessionSidebarProps) {
  const runtime = useChatRuntime();
  const { sessions } = useSessions();

  const handleCreate = useCallback(async () => {
    try {
      await runtime.createSession({
        title: `Chat ${new Date().toLocaleTimeString()}`,
        config: { model: "", backend: "" },
      });
    } catch {
      /* creation may fail if backend not ready */
    }
  }, [runtime]);

  const handleSelect = useCallback(async (id: string) => {
    try {
      await runtime.switchSession(id);
    } catch {
      /* session may no longer exist */
    }
  }, [runtime]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await runtime.deleteSession(id);
    } catch {
      /* session may already be deleted */
    }
  }, [runtime]);

  if (!open) {
    return (
      <div className="flex flex-col border-r border-border bg-muted/30 py-2 px-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" onClick={onToggle} className="size-8 p-0">
              <PanelLeftOpen className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Show sessions</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex w-56 flex-col border-r border-border bg-muted/30">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sessions</span>
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={handleCreate} className="size-7 p-0">
                <Plus className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New chat</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={onToggle} className="size-7 p-0">
                <PanelLeftClose className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Hide sessions</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <ThreadList
          sessions={sessions}
          activeSessionId={runtime.activeSessionId ?? undefined}
          onSelect={handleSelect}
          onDelete={handleDelete}
          className="sdk-thread-list"
        />
      </ScrollArea>
    </div>
  );
}

import { useState, useCallback, useEffect } from "react";
import { Bot, LogIn, LogOut, Loader2, Settings2 } from "lucide-react";
import type { Provider } from "./types";
import { PROVIDERS } from "./types";
import { AuthDialog } from "./components/AuthDialog";
import { SessionSidebar } from "./components/SessionSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChatProvider,
  useChat,
  Thread,
  Composer,
  useRemoteChat,
  ThreadProvider,
} from "@witqq/agent-sdk/chat/react";
import type { RemoteAuthBackend } from "@witqq/agent-sdk/chat/react";
import type { IChatRuntime } from "@witqq/agent-sdk/chat/runtime";
import type { ToolCallPart } from "@witqq/agent-sdk/chat/core";

export function App() {
  const [provider, setProvider] = useState<Provider>("copilot");

  return (
    <TooltipProvider>
      {/* key={provider} forces remount on provider switch, resetting all lifecycle state */}
      <AppContent key={provider} provider={provider} setProvider={setProvider} />
    </TooltipProvider>
  );
}

function AppContent({
  provider,
  setProvider,
}: {
  provider: Provider;
  setProvider: (p: Provider) => void;
}) {
  const chat = useRemoteChat({
    chatBaseUrl: "/api/chat",
    authBaseUrl: "/api",
    backend: provider as RemoteAuthBackend,
  });

  const [showAuth, setShowAuth] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState("");

  // Close auth dialog when authenticated
  useEffect(() => {
    if (chat.auth.status === "authenticated") setShowAuth(false);
  }, [chat.auth.status]);

  const handleLogout = useCallback(async () => {
    await chat.logout();
  }, [chat]);

  const handleModelSelect = useCallback(async (model: string) => {
    if (!chat.runtime) return;
    setSelectedModel(model);
    try { await chat.runtime.switchModel(model); } catch { /* best-effort */ }
  }, [chat.runtime]);

  const isReady = chat.phase === "ready" && chat.runtime;
  const isAuthenticated = chat.phase === "ready" || chat.phase === "creating";

  return (
    <div className="flex h-screen bg-background">
      {isReady ? (
        <ChatProvider runtime={chat.runtime}>
          <SessionSidebar
            open={sidebarOpen}
            onToggle={() => setSidebarOpen((v) => !v)}
          />
          <div className="flex flex-1 flex-col">
            <Header
              provider={provider}
              setProvider={setProvider}
              authenticated={true}
              selectedModel={selectedModel}
              onShowAuth={() => setShowAuth(true)}
              onLogout={handleLogout}
              onModelSelect={handleModelSelect}
              error=""
              runtime={chat.runtime}
            />
            <ChatArea />
          </div>
        </ChatProvider>
      ) : (
        <>
          <div className="flex flex-1 flex-col">
            <Header
              provider={provider}
              setProvider={setProvider}
              authenticated={isAuthenticated}
              selectedModel={selectedModel}
              onShowAuth={() => setShowAuth(true)}
              onLogout={handleLogout}
              onModelSelect={handleModelSelect}
              error={chat.error?.message || ""}
              runtime={null}
            />
            <div className="flex h-full items-center justify-center">
              <div className="text-center space-y-3 max-w-md px-4">
                <Bot className="size-12 text-muted-foreground mx-auto" />
                <h2 className="text-lg font-medium text-foreground">
                  {chat.phase === "initializing" && "Loading..."}
                  {chat.phase === "unauthenticated" && "Sign in to start"}
                  {chat.phase === "authenticating" && "Authenticating..."}
                  {chat.phase === "creating" && "Setting up..."}
                  {chat.phase === "error" && "Something went wrong"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {chat.phase === "unauthenticated"
                    ? "Choose a provider and sign in to begin chatting."
                    : chat.phase === "creating"
                      ? "Creating your chat session..."
                      : "Please wait..."}
                </p>
                {(chat.phase === "initializing" || chat.phase === "authenticating" || chat.phase === "creating") && (
                  <Loader2 className="size-6 animate-spin text-muted-foreground mx-auto" />
                )}
                {chat.error && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {chat.error.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <AuthDialog
        provider={provider}
        open={showAuth}
        onClose={() => setShowAuth(false)}
        auth={chat.auth}
      />
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────

interface HeaderProps {
  provider: Provider;
  setProvider: (p: Provider) => void;
  authenticated: boolean;
  selectedModel: string;
  onShowAuth: () => void;
  onLogout: () => void;
  onModelSelect: (model: string) => void;
  error: string;
  runtime: IChatRuntime | null;
}

function Header({
  provider,
  setProvider,
  authenticated,
  selectedModel,
  onShowAuth,
  onLogout,
  onModelSelect,
  runtime,
}: HeaderProps) {
  return (
    <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
      <Bot className="size-6 text-primary shrink-0" />
      <span className="text-sm font-semibold text-foreground shrink-0">agent-sdk</span>

      <div className="flex items-center gap-2 ml-4">
        <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
          <SelectTrigger size="sm" className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {PROVIDERS.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!authenticated ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" onClick={onShowAuth}>
                <LogIn className="size-3.5" />
                Sign in
              </Button>
            </TooltipTrigger>
            <TooltipContent>Authenticate with {provider}</TooltipContent>
          </Tooltip>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <span className="size-1.5 rounded-full bg-green-500" />
            Connected
          </Badge>
        )}

        {authenticated && runtime && (
          <ModelPicker selectedModel={selectedModel} onModelSelect={onModelSelect} runtime={runtime} />
        )}
      </div>

      <div className="ml-auto">
        {authenticated && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={onLogout}>
                <LogOut className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Disconnect</TooltipContent>
          </Tooltip>
        )}
      </div>
    </header>
  );
}

// ─── Model Picker ──────────────────────────────────────────────

interface ModelInfo {
  id: string;
  name?: string;
}

function ModelPicker({
  selectedModel,
  onModelSelect,
  runtime,
}: {
  selectedModel: string;
  onModelSelect: (model: string) => void;
  runtime: IChatRuntime;
}) {
  const [loadingModels, setLoadingModels] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    setLoadingModels(true);
    runtime.listModels()
      .then((list) => {
        setModels(list.length > 0 ? list.map(m => ({ id: m.id, name: m.name })) : []);
      })
      .catch(() => setModels([]))
      .finally(() => setLoadingModels(false));
  }, [runtime]);

  if (loadingModels) {
    return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  }

  if (models.length > 0) {
    return (
      <Select value={selectedModel} onValueChange={onModelSelect}>
        <SelectTrigger size="sm" className="w-[200px]">
          <SelectValue placeholder="Select model..." />
        </SelectTrigger>
        <SelectContent position="popper">
          {models.map((m) => (
            <SelectItem key={m.id} value={m.id}>{m.id}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <form className="flex gap-1" onSubmit={(e) => {
      e.preventDefault();
      const input = e.currentTarget.querySelector("input");
      if (input?.value) onModelSelect(input.value);
    }}>
      <Input placeholder="Model name..." defaultValue="gpt-4.1" className="h-8 w-[160px] text-sm" />
      <Button type="submit" size="sm" variant="outline">
        <Settings2 className="size-3.5" />
      </Button>
    </form>
  );
}

// ─── Chat Area (uses SDK hooks inside ChatProvider) ────────────

function ChatArea() {
  const { messages, sendMessage, stop, isGenerating, error, clearError } = useChat();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center py-20">
              <p className="text-sm text-muted-foreground">Send a message to start chatting.</p>
            </div>
          ) : (
            <ThreadProvider
              renderToolCall={(part: ToolCallPart) => (
                <div className="my-2 rounded-lg border border-border overflow-hidden">
                  <div className="flex items-center gap-2 bg-muted px-3 py-1.5 text-xs font-mono">
                    <span>{part.toolName === "bash" ? "💻" : part.toolName === "write" ? "📝" : part.toolName === "edit" ? "✏️" : "🔧"}</span>
                    <span className="font-semibold">{part.toolName}</span>
                    {part.status === "pending" && <Loader2 className="ml-auto h-3 w-3 animate-spin" />}
                  </div>
                  {part.args && (
                    <details className="text-xs">
                      <summary className="cursor-pointer px-3 py-1 text-muted-foreground hover:text-foreground">Arguments</summary>
                      <pre className="px-3 py-2 bg-background overflow-auto max-h-40 text-xs">{typeof part.args === "string" ? part.args : JSON.stringify(part.args, null, 2)}</pre>
                    </details>
                  )}
                  {part.result && (
                    <pre className="px-3 py-2 border-t border-border bg-background overflow-auto max-h-48 text-xs">{typeof part.result === "string" ? part.result : JSON.stringify(part.result, null, 2)}</pre>
                  )}
                </div>
              )}
            >
              <Thread
                messages={messages}
                isGenerating={isGenerating}
                className="sdk-thread"
              />
            </ThreadProvider>
          )}
          {isGenerating && (
            <div className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground">
              <span className="inline-block size-1.5 rounded-full bg-muted-foreground animate-pulse-dot" />
              <span className="inline-block size-1.5 rounded-full bg-muted-foreground animate-pulse-dot" />
              <span className="inline-block size-1.5 rounded-full bg-muted-foreground animate-pulse-dot" />
              <span className="ml-1">Thinking...</span>
            </div>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-auto max-w-3xl px-4 pb-2">
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex justify-between items-center">
            <span>{error.message}</span>
            <Button size="sm" variant="ghost" onClick={clearError}>✕</Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="mx-auto max-w-3xl">
          <Composer
            onSend={sendMessage}
            onStop={stop}
            isGenerating={isGenerating}
            className="sdk-composer"
          />
        </div>
      </div>
    </div>
  );
}

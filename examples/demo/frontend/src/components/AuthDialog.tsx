import { useEffect } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import type { Provider } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { UseRemoteAuthReturn } from "@witqq/agent-sdk/chat/react";
import { useRef } from "react";

interface Props {
  provider: Provider;
  open: boolean;
  onClose: () => void;
  auth: UseRemoteAuthReturn;
}

export function AuthDialog({ provider, open, onClose, auth }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const baseUrlRef = useRef<HTMLInputElement>(null);

  // Start auth flow when dialog opens
  useEffect(() => {
    if (!open) return;

    if (provider === "copilot") {
      auth.startDeviceFlow();
    } else if (provider === "claude") {
      auth.startOAuthFlow();
    }
    // vercel-ai waits for manual API key submission
  }, [open, provider]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Authenticate — {provider === "copilot" ? "GitHub Copilot" : provider === "claude" ? "Claude" : "Vercel AI"}
          </DialogTitle>
          <DialogDescription>
            {provider === "copilot" && "Sign in with your GitHub account"}
            {provider === "claude" && "Authorize with your Anthropic account"}
            {provider === "vercel-ai" && "Enter your API key"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {auth.status === "pending" && provider === "copilot" && !auth.deviceCode && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Starting authentication...
            </div>
          )}

          {provider === "copilot" && auth.deviceCode && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Enter this code:</p>
              <div className="rounded-md bg-secondary px-4 py-3 text-center font-mono text-2xl font-bold tracking-widest">
                {auth.deviceCode}
              </div>
              {auth.verificationUrl && (
                <a
                  href={auth.verificationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" />
                  {auth.verificationUrl}
                </a>
              )}
              {auth.status === "pending" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Waiting for authorization...
                </div>
              )}
            </div>
          )}

          {provider === "claude" && auth.authorizeUrl && (
            <div className="space-y-3">
              <a
                href={auth.authorizeUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-sm text-primary hover:underline break-all"
              >
                <ExternalLink className="size-3.5 shrink-0" />
                Open authorization page
              </a>
              <p className="text-sm text-muted-foreground">Paste the code or redirect URL:</p>
              <div className="flex gap-2">
                <Input ref={inputRef} placeholder="Paste code or redirect URL..." />
                <Button onClick={() => {
                  const code = inputRef.current?.value?.trim();
                  if (code) auth.completeOAuth(code);
                }}>Submit</Button>
              </div>
            </div>
          )}

          {provider === "vercel-ai" && auth.status !== "pending" && (
            <div className="space-y-3">
              <Input ref={baseUrlRef} placeholder="Base URL (default: https://api.openai.com/v1)" />
              <div className="flex gap-2">
                <Input ref={inputRef} type="password" placeholder="API Key (sk-...)" />
                <Button onClick={() => {
                  const key = inputRef.current?.value?.trim();
                  if (key) auth.submitApiKey(key, baseUrlRef.current?.value?.trim() || undefined);
                }}>Connect</Button>
              </div>
            </div>
          )}

          {auth.status === "authenticated" && (
            <div className="rounded-md p-3 text-sm border border-primary/30 bg-primary/10 text-primary">
              Authenticated
            </div>
          )}

          {auth.error && (
            <div className="rounded-md p-3 text-sm border border-destructive/30 bg-destructive/10 text-destructive">
              {auth.error.message}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

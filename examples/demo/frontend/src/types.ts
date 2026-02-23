/** Shared types for the demo frontend. */
export type Provider = "copilot" | "claude" | "vercel-ai";

export const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "copilot", label: "GitHub Copilot" },
  { id: "claude", label: "Claude" },
  { id: "vercel-ai", label: "Vercel AI" },
];

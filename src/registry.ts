import type {
  IAgentService,
  CopilotBackendOptions,
  ClaudeBackendOptions,
  VercelAIBackendOptions,
} from "./types.js";
import {
  BackendNotFoundError,
  BackendAlreadyRegisteredError,
} from "./errors.js";

// ─── Backend Factory Types ──────────────────────────────────────

/** Factory function that creates a backend service from options */
export type BackendFactory<TOptions = unknown> = (
  options: TOptions,
) => IAgentService | Promise<IAgentService>;

/** Map of built-in backend names to their options types */
export interface BackendOptionsMap {
  copilot: CopilotBackendOptions;
  claude: ClaudeBackendOptions;
  "vercel-ai": VercelAIBackendOptions;
}

/** All known backend names (built-in + custom) */
export type BuiltinBackendName = keyof BackendOptionsMap;

// ─── Registry ───────────────────────────────────────────────────

interface RegistryEntry {
  factory: BackendFactory;
  /** Whether this is a built-in backend loaded lazily */
  builtin: boolean;
}

const registry = new Map<string, RegistryEntry>();

/** Register a custom backend factory */
export function registerBackend<TOptions = unknown>(
  name: string,
  factory: BackendFactory<TOptions>,
): void {
  if (registry.has(name)) {
    throw new BackendAlreadyRegisteredError(name);
  }
  registry.set(name, { factory: factory as BackendFactory, builtin: false });
}

/** Unregister a backend (primarily for testing) */
export function unregisterBackend(name: string): boolean {
  return registry.delete(name);
}

/** Check if a backend is registered */
export function hasBackend(name: string): boolean {
  return registry.has(name) || isBuiltinName(name);
}

/** List all registered backend names */
export function listBackends(): string[] {
  const names = new Set<string>(registry.keys());
  for (const builtin of BUILTIN_BACKENDS) {
    names.add(builtin);
  }
  return [...names];
}

/** Reset registry to initial state (for testing) */
export function resetRegistry(): void {
  registry.clear();
}

// ─── Built-in Backend Names ─────────────────────────────────────

const BUILTIN_BACKENDS: ReadonlySet<string> = new Set([
  "copilot",
  "claude",
  "vercel-ai",
]);

function isBuiltinName(name: string): name is BuiltinBackendName {
  return BUILTIN_BACKENDS.has(name);
}

// ─── Lazy Import for Built-in Backends ──────────────────────────

async function loadBuiltinFactory(
  name: BuiltinBackendName,
): Promise<BackendFactory> {
  switch (name) {
    case "copilot": {
      const mod = await import("./backends/copilot.js");
      return (opts: unknown) =>
        mod.createCopilotService(opts as CopilotBackendOptions);
    }
    case "claude": {
      const mod = await import("./backends/claude.js");
      return (opts: unknown) =>
        mod.createClaudeService(opts as ClaudeBackendOptions);
    }
    case "vercel-ai": {
      const mod = await import("./backends/vercel-ai.js");
      return (opts: unknown) =>
        mod.createVercelAIService(opts as VercelAIBackendOptions);
    }
  }
}

// ─── Type-Safe Factory (B6) ─────────────────────────────────────

/** Create a backend service with type-safe options */
export async function createAgentService<K extends BuiltinBackendName>(
  name: K,
  options: BackendOptionsMap[K],
): Promise<IAgentService>;
export async function createAgentService(
  name: string,
  options: unknown,
): Promise<IAgentService>;
export async function createAgentService(
  name: string,
  options: unknown,
): Promise<IAgentService> {
  // Check custom registry first
  const entry = registry.get(name);
  if (entry) {
    return entry.factory(options);
  }

  // Try built-in lazy load
  if (isBuiltinName(name)) {
    const factory = await loadBuiltinFactory(name);
    // Cache for future calls
    registry.set(name, { factory, builtin: true });
    return factory(options);
  }

  throw new BackendNotFoundError(name);
}

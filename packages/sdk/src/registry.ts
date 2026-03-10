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

/** Cached service instances keyed by "backend:configId" */
const serviceCache = new Map<string, IAgentService>();

function configCacheKey(name: string, configId: string): string {
  return `${name}:${configId}`;
}

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

/** Check if a backend is registered (eagerly or lazily) */
export function hasBackend(name: string): boolean {
  return registry.has(name) || lazyLoaders.has(name);
}

/** List all registered backend names (eager + lazy) */
export function listBackends(): string[] {
  const names = new Set<string>(registry.keys());
  for (const name of lazyLoaders.keys()) {
    names.add(name);
  }
  return [...names];
}

/** Reset registry to initial state (for testing) */
export function resetRegistry(): void {
  registry.clear();
  serviceCache.clear();
}

/** Dispose all cached service instances for a backend, or a single named config.
 *  Returns the number of instances disposed. */
export async function disposeBackend(
  name: string,
  configId?: string,
): Promise<number> {
  if (configId !== undefined) {
    const key = configCacheKey(name, configId);
    const svc = serviceCache.get(key);
    if (!svc) return 0;
    serviceCache.delete(key);
    await svc.dispose();
    return 1;
  }
  const prefix = `${name}:`;
  const toDispose: IAgentService[] = [];
  for (const [key, svc] of serviceCache) {
    if (key.startsWith(prefix)) {
      toDispose.push(svc);
      serviceCache.delete(key);
    }
  }
  await Promise.all(toDispose.map((s) => s.dispose()));
  return toDispose.length;
}

/** List all active config IDs for a backend */
export function listConfigs(name: string): string[] {
  const prefix = `${name}:`;
  const ids: string[] = [];
  for (const key of serviceCache.keys()) {
    if (key.startsWith(prefix)) {
      ids.push(key.slice(prefix.length));
    }
  }
  return ids;
}

// ─── Lazy Backend Loader Registry ───────────────────────────────

/** Lazy loader: async function that returns a BackendFactory */
type LazyBackendLoader = () => Promise<BackendFactory>;

/** Map of backend name → lazy loader. Extensible via registerLazyBackend(). */
const lazyLoaders = new Map<string, LazyBackendLoader>([
  [
    "copilot",
    async () => {
      const mod = await import("./backends/copilot.js");
      return (opts: unknown) =>
        mod.createCopilotService(opts as CopilotBackendOptions);
    },
  ],
  [
    "claude",
    async () => {
      const mod = await import("./backends/claude.js");
      return (opts: unknown) =>
        mod.createClaudeService(opts as ClaudeBackendOptions);
    },
  ],
  [
    "vercel-ai",
    async () => {
      const mod = await import("./backends/vercel-ai.js");
      return (opts: unknown) =>
        mod.createVercelAIService(opts as VercelAIBackendOptions);
    },
  ],
]);

/**
 * Register a lazy-loaded backend. The loader is called once on first use,
 * then the resulting factory is cached in the main registry.
 * Use this for backends that have heavy dependencies (peer deps, native modules).
 */
export function registerLazyBackend(
  name: string,
  loader: () => Promise<BackendFactory>,
): void {
  lazyLoaders.set(name, loader);
}

// ─── Type-Safe Factory (B6) ─────────────────────────────────────

/** Create a backend service with type-safe options.
 *  When `configId` is provided, the service instance is cached and reused
 *  on subsequent calls with the same name+configId pair. Without configId,
 *  a new instance is created every call. */
export async function createAgentService<K extends BuiltinBackendName>(
  name: K,
  options: BackendOptionsMap[K],
  configId?: string,
): Promise<IAgentService>;
export async function createAgentService(
  name: string,
  options: unknown,
  configId?: string,
): Promise<IAgentService>;
export async function createAgentService(
  name: string,
  options: unknown,
  configId?: string,
): Promise<IAgentService> {
  // Named config: check instance cache first
  if (configId !== undefined) {
    const key = configCacheKey(name, configId);
    const cached = serviceCache.get(key);
    if (cached) return cached;
    const service = await createServiceInstance(name, options);
    serviceCache.set(key, service);
    return service;
  }

  // Default (no configId): create fresh instance every call
  return createServiceInstance(name, options);
}

async function createServiceInstance(
  name: string,
  options: unknown,
): Promise<IAgentService> {
  // Check eager registry first
  const entry = registry.get(name);
  if (entry) {
    return entry.factory(options);
  }

  // Try lazy-loaded backend
  const loader = lazyLoaders.get(name);
  if (loader) {
    const factory = await loader();
    // Cache factory in eager registry for future calls
    registry.set(name, { factory, builtin: true });
    return factory(options);
  }

  throw new BackendNotFoundError(name);
}

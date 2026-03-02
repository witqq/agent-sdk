import { useState, useCallback, useEffect, useRef } from "react";
import { useChatRuntime } from "./ChatProvider.js";
import type { ProviderConfig } from "../provider-types.js";

/** Runtime that supports provider operations. */
interface ProviderCapable {
  listProviders(): Promise<ProviderConfig[]>;
  createProvider(config: Omit<ProviderConfig, "id" | "createdAt">): Promise<ProviderConfig>;
  updateProvider(id: string, changes: Partial<Omit<ProviderConfig, "id" | "createdAt">>): Promise<ProviderConfig>;
  deleteProvider(id: string): Promise<void>;
  selectProvider(id: string): void;
}

/** Check if runtime supports provider operations via feature detection. */
function isProviderCapable(runtime: unknown): runtime is ProviderCapable {
  return (
    typeof runtime === "object" &&
    runtime !== null &&
    typeof (runtime as Record<string, unknown>).listProviders === "function"
  );
}

/** Return type for the useProviders hook. */
export interface UseProvidersReturn {
  providers: ProviderConfig[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
  createProvider: (config: Omit<ProviderConfig, "id" | "createdAt">) => Promise<void>;
  updateProvider: (id: string, changes: Partial<Omit<ProviderConfig, "id" | "createdAt">>) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  selectProvider: (id: string) => void;
}

/**
 * Hook for managing providers (backend + model combos).
 * Requires an IChatClient with provider methods (e.g. RemoteChatClient).
 */
export function useProviders(): UseProvidersReturn {
  const runtime = useChatRuntime();
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const fetchProviders = useCallback(() => {
    setIsLoading(true);
    setError(null);
    if (!isProviderCapable(runtime)) {
      setIsLoading(false);
      return;
    }
    runtime.listProviders()
      .then((data) => {
        if (mountedRef.current) {
          setProviders(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      });
  }, [runtime]);

  useEffect(() => {
    mountedRef.current = true;
    fetchProviders();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchProviders]);

  const createProvider = useCallback(
    async (config: Omit<ProviderConfig, "id" | "createdAt">) => {
      if (!isProviderCapable(runtime)) return;
      try {
        await runtime.createProvider(config);
        fetchProviders();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [runtime, fetchProviders],
  );

  const updateProvider = useCallback(
    async (id: string, changes: Partial<Omit<ProviderConfig, "id" | "createdAt">>) => {
      if (!isProviderCapable(runtime)) return;
      try {
        await runtime.updateProvider(id, changes);
        fetchProviders();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [runtime, fetchProviders],
  );

  const deleteProvider = useCallback(
    async (id: string) => {
      if (!isProviderCapable(runtime)) return;
      try {
        await runtime.deleteProvider(id);
        fetchProviders();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [runtime, fetchProviders],
  );

  const selectProvider = useCallback(
    (id: string) => {
      if (!isProviderCapable(runtime)) return;
      runtime.selectProvider(id);
    },
    [runtime],
  );

  return { providers, isLoading, error, refresh: fetchProviders, createProvider, updateProvider, deleteProvider, selectProvider };
}

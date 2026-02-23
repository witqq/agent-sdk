import { useState, useCallback, useEffect, useRef } from "react";
import { useChatRuntime } from "./ChatProvider.js";

/** Model display option returned by useModels (mapped from core ModelInfo). */
export interface ModelOption {
  id: string;
  name: string;
  tier?: string;
}

/** @deprecated Use ModelOption instead — renamed to avoid collision with core ModelInfo */
export type ModelInfo = ModelOption;

/** Return type for the useModels hook. */
export interface UseModelsReturn {
  models: ModelOption[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
  search: (query: string) => ModelOption[];
}

/**
 * Hook for fetching and searching available models from the chat runtime.
 */
export function useModels(): UseModelsReturn {
  const runtime = useChatRuntime();
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await runtime.listModels();
      if (!mountedRef.current) return;
      const mapped: ModelOption[] = result.map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        tier: m.provider,
      }));
      setModels(mapped);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [runtime]);

  useEffect(() => {
    mountedRef.current = true;
    fetchModels();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchModels]);

  const search = useCallback(
    (query: string): ModelOption[] => {
      const q = query.toLowerCase();
      return models.filter((m) => m.name.toLowerCase().includes(q));
    },
    [models],
  );

  return { models, isLoading, error, refresh: fetchModels, search };
}

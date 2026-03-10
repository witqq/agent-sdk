import { useState, useCallback, useEffect, useRef } from "react";
import { useChatRuntime } from "./ChatProvider.js";
import type { BackendInfo } from "../runtime.js";

/** Return type for the useBackends hook. */
export interface UseBackendsReturn {
  backends: BackendInfo[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Hook for discovering registered backends and switching between them.
 */
export function useBackends(): UseBackendsReturn {
  const runtime = useChatRuntime();
  const [backends, setBackends] = useState<BackendInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const fetchBackends = useCallback(() => {
    setIsLoading(true);
    setError(null);
    try {
      // listBackends is sync on ChatRuntime, async on RemoteChatClient
      const result = runtime.listBackends();
      if (result instanceof Promise) {
        (result as Promise<BackendInfo[]>)
          .then((data) => {
            if (mountedRef.current) {
              setBackends(data);
              setIsLoading(false);
            }
          })
          .catch((err) => {
            if (mountedRef.current) {
              setError(err instanceof Error ? err : new Error(String(err)));
              setIsLoading(false);
            }
          });
      } else {
        if (mountedRef.current) {
          setBackends(result);
          setIsLoading(false);
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      }
    }
  }, [runtime]);

  useEffect(() => {
    mountedRef.current = true;
    fetchBackends();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchBackends]);

  return { backends, isLoading, error, refresh: fetchBackends };
}

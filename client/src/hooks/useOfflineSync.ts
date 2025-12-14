import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

interface PendingAction {
  id: string;
  type: string;
  data: any;
  timestamp: number;
}

const STORAGE_KEY = "campovivo_offline_queue";
const OFFLINE_DATA_KEY = "campovivo_offline_data";

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load pending actions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPendingActions(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse offline queue:", e);
      }
    }
  }, []);

  // Save pending actions to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingActions));
  }, [pendingActions]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Conexão restaurada", {
        description: "Sincronizando dados...",
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Sem conexão", {
        description: "Os dados serão salvos localmente e sincronizados quando a conexão for restaurada.",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Add action to queue
  const queueAction = useCallback((type: string, data: any) => {
    const action: PendingAction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
    };
    setPendingActions((prev) => [...prev, action]);
    return action.id;
  }, []);

  // Remove action from queue
  const removeAction = useCallback((id: string) => {
    setPendingActions((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Clear all pending actions
  const clearQueue = useCallback(() => {
    setPendingActions([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Cache data for offline use
  const cacheData = useCallback((key: string, data: any) => {
    try {
      const stored = localStorage.getItem(OFFLINE_DATA_KEY);
      const cache = stored ? JSON.parse(stored) : {};
      cache[key] = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(cache));
    } catch (e) {
      console.error("Failed to cache data:", e);
    }
  }, []);

  // Get cached data
  const getCachedData = useCallback((key: string) => {
    try {
      const stored = localStorage.getItem(OFFLINE_DATA_KEY);
      if (!stored) return null;
      const cache = JSON.parse(stored);
      return cache[key]?.data || null;
    } catch (e) {
      console.error("Failed to get cached data:", e);
      return null;
    }
  }, []);

  // Clear cached data
  const clearCache = useCallback(() => {
    localStorage.removeItem(OFFLINE_DATA_KEY);
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingActions,
    pendingCount: pendingActions.length,
    queueAction,
    removeAction,
    clearQueue,
    cacheData,
    getCachedData,
    clearCache,
  };
}

// Hook for specific data caching
export function useOfflineData<T>(key: string, fetchFn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isOnline, cacheData, getCachedData } = useOfflineSync();

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      // Try to get cached data first
      const cached = getCachedData(key);
      if (cached) {
        setData(cached);
      }

      // If online, fetch fresh data
      if (isOnline) {
        try {
          const freshData = await fetchFn();
          setData(freshData);
          cacheData(key, freshData);
        } catch (e) {
          console.error("Failed to fetch data:", e);
          // Keep using cached data if fetch fails
        }
      }

      setIsLoading(false);
    };

    loadData();
  }, [key, isOnline, fetchFn, cacheData, getCachedData]);

  return { data, isLoading, isOnline };
}

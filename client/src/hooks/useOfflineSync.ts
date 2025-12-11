import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface PendingChange {
  localId: string;
  action: "create" | "update" | "delete";
  entityType: "fields" | "notes" | "tasks";
  data: any;
  timestamp: number;
}

const STORAGE_KEY = "campovivo_offline_queue";
const OFFLINE_DATA_KEY = "campovivo_offline_data";
const LAST_SYNC_KEY = "campovivo_last_sync";

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncInProgress = useRef(false);
  
  // tRPC mutations
  const pushChangesMutation = trpc.sync.pushChanges.useMutation();
  const utils = trpc.useUtils();

  // Load pending changes from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPendingChanges(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse offline queue:", e);
      }
    }
  }, []);

  // Save pending changes to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingChanges));
  }, [pendingChanges]);

  // Sync function
  const syncChanges = useCallback(async () => {
    if (syncInProgress.current || pendingChanges.length === 0 || !isOnline) return;
    
    syncInProgress.current = true;
    setIsSyncing(true);
    
    try {
      // Group changes by entity type
      const fields = pendingChanges
        .filter(c => c.entityType === "fields")
        .map(c => ({ localId: c.localId, action: c.action, data: c.data }));
      const notes = pendingChanges
        .filter(c => c.entityType === "notes")
        .map(c => ({ localId: c.localId, action: c.action, data: c.data }));
      const tasks = pendingChanges
        .filter(c => c.entityType === "tasks")
        .map(c => ({ localId: c.localId, action: c.action, data: c.data }));
      
      const result = await pushChangesMutation.mutateAsync({
        fields: fields.length > 0 ? fields : undefined,
        notes: notes.length > 0 ? notes : undefined,
        tasks: tasks.length > 0 ? tasks : undefined,
      });
      
      // Remove successful changes from queue
      const successfulIds = new Set<string>();
      result.results.fields.filter(r => r.success).forEach(r => successfulIds.add(r.localId));
      result.results.notes.filter(r => r.success).forEach(r => successfulIds.add(r.localId));
      result.results.tasks.filter(r => r.success).forEach(r => successfulIds.add(r.localId));
      
      setPendingChanges(prev => prev.filter(c => !successfulIds.has(c.localId)));
      
      // Update last sync timestamp
      localStorage.setItem(LAST_SYNC_KEY, result.serverTimestamp);
      
      // Invalidate queries to refresh data
      utils.fields.list.invalidate();
      utils.notes.listAll.invalidate();
      utils.tasks.list.invalidate();
      
      const syncedCount = successfulIds.size;
      if (syncedCount > 0) {
        toast.success(`${syncedCount} alterações sincronizadas`);
      }
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error("Falha na sincronização. Tentaremos novamente.");
    } finally {
      setIsSyncing(false);
      syncInProgress.current = false;
    }
  }, [pendingChanges, isOnline, pushChangesMutation, utils]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Conexão restaurada", {
        description: "Sincronizando dados...",
      });
      // Auto-sync when back online
      setTimeout(() => syncChanges(), 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Sem conexão", {
        description: "Os dados serão salvos localmente.",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncChanges]);

  // Add change to queue
  const queueChange = useCallback((
    entityType: "fields" | "notes" | "tasks",
    action: "create" | "update" | "delete",
    data: any
  ) => {
    const change: PendingChange = {
      localId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      entityType,
      action,
      data,
      timestamp: Date.now(),
    };
    setPendingChanges((prev) => [...prev, change]);
    
    // Try to sync immediately if online
    if (isOnline) {
      setTimeout(() => syncChanges(), 100);
    }
    
    return change.localId;
  }, [isOnline, syncChanges]);

  // Remove change from queue
  const removeChange = useCallback((localId: string) => {
    setPendingChanges((prev) => prev.filter((c) => c.localId !== localId));
  }, []);

  // Clear all pending changes
  const clearQueue = useCallback(() => {
    setPendingChanges([]);
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

  // Get last sync timestamp
  const getLastSyncTimestamp = useCallback(() => {
    return localStorage.getItem(LAST_SYNC_KEY);
  }, []);

  return {
    isOnline,
    isSyncing,
    pendingChanges,
    pendingCount: pendingChanges.length,
    queueChange,
    removeChange,
    clearQueue,
    syncChanges,
    cacheData,
    getCachedData,
    clearCache,
    getLastSyncTimestamp,
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

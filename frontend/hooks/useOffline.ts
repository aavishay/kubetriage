import { useState, useEffect, useCallback, useRef } from 'react';
import { syncQueuedActions, getCacheStats } from '../services/offlineService';

interface OfflineState {
  isOnline: boolean;
  isSyncing: boolean;
  queuedActions: number;
  cachedEntries: number;
  lastSyncAt: Date | null;
}

export function useOffline(): OfflineState & { triggerSync: () => Promise<void> } {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queuedActions, setQueuedActions] = useState(0);
  const [cachedEntries, setCachedEntries] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateStats = useCallback(async () => {
    const stats = await getCacheStats();
    setQueuedActions(stats.queueSize);
    setCachedEntries(stats.entries);
  }, []);

  const triggerSync = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return;

    setIsSyncing(true);
    try {
      await syncQueuedActions((completed, total) => {
        // Could emit progress events here
      });
      setLastSyncAt(new Date());
      await updateStats();
    } catch {
      // Sync failed, will retry on next online event
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, updateStats]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Debounce sync to let network stabilize
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        triggerSync();
      }, 2000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    updateStats();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [triggerSync, updateStats]);

  // Periodic stats refresh
  useEffect(() => {
    const interval = setInterval(updateStats, 30000);
    return () => clearInterval(interval);
  }, [updateStats]);

  return {
    isOnline,
    isSyncing,
    queuedActions,
    cachedEntries,
    lastSyncAt,
    triggerSync
  };
}

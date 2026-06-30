import React, { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, ArrowUpCircle } from 'lucide-react';
import { useOffline } from '../hooks/useOffline';

export const OfflineIndicator: React.FC = () => {
  const { isOnline, isSyncing, queuedActions, cachedEntries, lastSyncAt, triggerSync } = useOffline();
  const [showDetails, setShowDetails] = useState(false);

  if (isOnline && queuedActions === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {showDetails && (
        <div className="kt-panel w-72 kt-animate-fade-in p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold tracking-wider uppercase text-sm text-text-primary">
              Offline Status
            </h3>
            <button
              onClick={() => setShowDetails(false)}
              className="kt-button kt-button-ghost kt-button-sm"
            >
              Close
            </button>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Connection</span>
              <span className={`font-bold ${isOnline ? 'text-success' : 'text-danger'}`}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Cached Entries</span>
              <span className="font-bold text-text-primary">{cachedEntries}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Queued Actions</span>
              <span className={`font-bold ${queuedActions > 0 ? 'text-warning' : 'text-text-primary'}`}>
                {queuedActions}
              </span>
            </div>

            {lastSyncAt && (
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Last Sync</span>
                <span className="text-text-tertiary">
                  {lastSyncAt.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>

          {isOnline && queuedActions > 0 && (
            <button
              onClick={triggerSync}
              disabled={isSyncing}
              className="mt-3 w-full kt-button kt-button-primary kt-button-sm"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'SYNCING...' : `SYNC ${queuedActions} ACTION${queuedActions !== 1 ? 'S' : ''}`}
            </button>
          )}

          {!isOnline && (
            <p className="mt-3 font-mono text-[10px] text-text-tertiary text-center">
              Actions will sync automatically when connection is restored.
            </p>
          )}
        </div>
      )}

      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`kt-button kt-button-sm border ${
          !isOnline
            ? 'bg-danger-light text-danger border-danger/25 hover:border-danger'
            : queuedActions > 0
            ? 'bg-warning-light text-warning border-warning/25 hover:border-warning'
            : 'bg-success-light text-success border-success/25 hover:border-success'
        }`}
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4" />
            <span className="font-bold">Offline</span>
          </>
        ) : queuedActions > 0 ? (
          <>
            <ArrowUpCircle className="w-4 h-4 animate-pulse" />
            <span className="font-bold">{queuedActions} Pending</span>
          </>
        ) : (
          <>
            <Wifi className="w-4 h-4" />
            <span className="font-bold">Online</span>
          </>
        )}
      </button>
    </div>
  );
};

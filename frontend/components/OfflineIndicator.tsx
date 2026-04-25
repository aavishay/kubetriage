import React, { useState } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, Database, ArrowUpCircle } from 'lucide-react';
import { useOffline } from '../hooks/useOffline';

export const OfflineIndicator: React.FC = () => {
  const { isOnline, isSyncing, queuedActions, cachedEntries, lastSyncAt, triggerSync } = useOffline();
  const [showDetails, setShowDetails] = useState(false);

  if (isOnline && queuedActions === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Details Panel */}
      {showDetails && (
        <div className="bg-bg-card border border-border-main rounded-xl shadow-lg p-4 w-72 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-text-primary">Offline Status</h3>
            <button
              onClick={() => setShowDetails(false)}
              className="text-text-tertiary hover:text-text-primary text-xs"
            >
              Close
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Connection</span>
              <span className={`text-xs font-bold ${isOnline ? 'text-emerald-500' : 'text-rose-500'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Cached Entries</span>
              <span className="text-xs font-bold text-text-primary">{cachedEntries}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Queued Actions</span>
              <span className={`text-xs font-bold ${queuedActions > 0 ? 'text-amber-500' : 'text-text-primary'}`}>
                {queuedActions}
              </span>
            </div>

            {lastSyncAt && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Last Sync</span>
                <span className="text-xs text-text-tertiary">
                  {lastSyncAt.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>

          {isOnline && queuedActions > 0 && (
            <button
              onClick={triggerSync}
              disabled={isSyncing}
              className="mt-3 w-full kt-button kt-button-primary flex items-center justify-center gap-2 text-xs py-2"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : `Sync ${queuedActions} Action${queuedActions !== 1 ? 's' : ''}`}
            </button>
          )}

          {!isOnline && (
            <p className="mt-3 text-[10px] text-text-tertiary text-center">
              Actions will sync automatically when connection is restored.
            </p>
          )}
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border shadow-lg transition-all hover:scale-105 ${
          !isOnline
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
            : queuedActions > 0
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
        }`}
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4" />
            <span className="text-xs font-bold">Offline</span>
          </>
        ) : queuedActions > 0 ? (
          <>
            <ArrowUpCircle className="w-4 h-4 animate-pulse" />
            <span className="text-xs font-bold">{queuedActions} Pending</span>
          </>
        ) : (
          <>
            <Wifi className="w-4 h-4" />
            <span className="text-xs font-bold">Online</span>
          </>
        )}
      </button>
    </div>
  );
};

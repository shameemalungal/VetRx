// ==============================================================================
// VetRx — SyncStatusIndicator.tsx
// Reactive offline synchronization status indicator with pending, syncing,
// synced, and failed states derived directly from persistence and sync results.
// ==============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { useSyncStatus, syncAllClinicalData } from '../../services/clinicalSync';
import './SyncStatusIndicator.css';

interface SyncStatusIndicatorProps {
  compact?: boolean;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ compact = false }) => {
  const { state, lastSyncedAt, lastError, pendingCount, isOnline } = useSyncStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleManualSync = async () => {
    setIsRetrying(true);
    try {
      await syncAllClinicalData(null, true);
    } finally {
      setIsRetrying(false);
    }
  };

  const getLabel = () => {
    switch (state) {
      case 'syncing':
        return 'Syncing…';
      case 'synced':
        return 'Synced';
      case 'pending':
        return pendingCount > 0 ? `Pending (${pendingCount})` : 'Offline (Pending)';
      case 'failed':
        return 'Sync Failed';
      default:
        return 'Synced';
    }
  };

  const getAriaLive = () => {
    return state === 'failed' ? 'assertive' : 'polite';
  };

  const formatLastSynced = () => {
    if (!lastSyncedAt) return 'Not synced in this session';
    const secondsAgo = Math.floor((Date.now() - lastSyncedAt.getTime()) / 1000);
    if (secondsAgo < 60) return 'Just now';
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    return lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className="sync-status-container"
      ref={containerRef}
      id="sync-status-indicator"
      data-testid="sync-status-indicator"
      data-sync-state={state}
      aria-live={getAriaLive()}
    >
      <button
        type="button"
        className={`sync-status-badge status-${state}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title={`Synchronization status: ${getLabel()}. Click for details.`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className="sync-dot" aria-hidden="true" />
        {!compact && <span className="sync-label">{getLabel()}</span>}
        {compact && pendingCount > 0 && <span className="sync-label-count">{pendingCount}</span>}
      </button>

      {isOpen && (
        <div className="sync-popover" role="dialog" aria-label="Synchronization details">
          <div className="sync-popover-header">
            <span className="sync-popover-title">Clinical Data Sync</span>
            <button
              type="button"
              className="sync-popover-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close sync details"
            >
              ✕
            </button>
          </div>

          <div className="sync-popover-desc">
            <div>
              <strong>Status:</strong>{' '}
              <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{state}</span>
              {!isOnline && ' (Offline)'}
            </div>
            <div>
              <strong>Last Synced:</strong> {formatLastSynced()}
            </div>
            {pendingCount > 0 && (
              <div style={{ color: '#b45309', marginTop: '4px' }}>
                <strong>Pending changes:</strong> {pendingCount} record{pendingCount > 1 ? 's' : ''} awaiting server push
              </div>
            )}
          </div>

          {state === 'failed' && lastError && (
            <div className="sync-popover-error" role="alert">
              <strong>Failure Details:</strong> {lastError}
            </div>
          )}

          <button
            type="button"
            className="sync-popover-action"
            onClick={handleManualSync}
            disabled={state === 'syncing' || isRetrying}
          >
            {state === 'syncing' || isRetrying ? 'Synchronizing…' : 'Sync Now'}
          </button>
        </div>
      )}
    </div>
  );
};

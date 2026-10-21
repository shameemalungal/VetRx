// ==============================================================================
// VetRx — InventoryEntitlementContext.tsx
// Evaluates server-side 'inventory_management' add-on entitlement state.
// Frontend is never source of truth; reflects backend entitlement response.
// ==============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { inventoryApi } from '../services/inventoryApi';
import { useAuth } from './AuthContext';

export type EntitlementStatus = 'unresolved' | 'loading' | 'entitled' | 'unentitled' | 'error';

export interface InventoryEntitlementContextType {
  isEntitled: boolean;
  isLoading: boolean;
  isResolved: boolean;
  status: EntitlementStatus;
  mockMode: boolean;
  reason?: string;
  error?: string | null;
  practiceId?: string | null;
  refetchEntitlement: () => Promise<void>;
  toggleDevEntitlement: (enabled: boolean) => Promise<boolean>;
}

const InventoryEntitlementContext = createContext<InventoryEntitlementContextType>({
  isEntitled: false,
  isLoading: false,
  isResolved: false,
  status: 'unresolved',
  mockMode: false,
  error: null,
  practiceId: null,
  refetchEntitlement: async () => {},
  toggleDevEntitlement: async () => false,
});

export const InventoryEntitlementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { practice, user } = useAuth();
  const currentPracticeId = practice?.id || null;
  const currentUserId = user?.id || null;

  const [isEntitled, setIsEntitled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(currentPracticeId && currentUserId));
  const [isResolved, setIsResolved] = useState<boolean>(false);
  const [status, setStatus] = useState<EntitlementStatus>(
    currentPracticeId && currentUserId ? 'loading' : 'unresolved'
  );
  const [mockMode, setMockMode] = useState<boolean>(false);
  const [reason, setReason] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // Guard against race conditions when switching practices or re-authenticating
  const activeRequestPracticeIdRef = useRef<string | null>(null);

  const fetchEntitlement = useCallback(async () => {
    if (!currentPracticeId || !currentUserId) {
      activeRequestPracticeIdRef.current = null;
      setIsEntitled(false);
      setIsLoading(false);
      setIsResolved(false);
      setStatus('unresolved');
      setReason(undefined);
      setError(null);
      return;
    }

    activeRequestPracticeIdRef.current = currentPracticeId;
    setIsLoading(true);
    setStatus('loading');
    setError(null);

    try {
      const res = await inventoryApi.getEntitlement();
      // Guard against race conditions: commit ONLY if active practice hasn't changed in the meantime
      if (activeRequestPracticeIdRef.current === currentPracticeId) {
        const entitled = Boolean(res.entitled);
        setIsEntitled(entitled);
        setIsResolved(true);
        setStatus(entitled ? 'entitled' : 'unentitled');
        setMockMode(Boolean(res.mockMode));
        setReason(res.reason);
        setError(null);
      }
    } catch (err: unknown) {
      if (activeRequestPracticeIdRef.current === currentPracticeId) {
        // Entitlement API failure must NEVER grant access (fail-closed)
        setIsEntitled(false);
        setIsResolved(true);
        setStatus('error');
        const errMsg = err instanceof Error ? err.message : 'Failed to verify inventory entitlement';
        setError(errMsg);
        setReason('Entitlement check failed');
      }
    } finally {
      if (activeRequestPracticeIdRef.current === currentPracticeId) {
        setIsLoading(false);
      }
    }
  }, [currentPracticeId, currentUserId]);

  useEffect(() => {
    // Whenever practice changes or user logs in/out, immediately reset entitlement of prior practice
    if (currentPracticeId && currentUserId) {
      setIsEntitled(false);
      setIsResolved(false);
      setIsLoading(true);
      setStatus('loading');
      setReason(undefined);
      setError(null);
    } else {
      setIsEntitled(false);
      setIsResolved(false);
      setIsLoading(false);
      setStatus('unresolved');
      setReason(undefined);
      setError(null);
    }
    void fetchEntitlement();
  }, [currentPracticeId, currentUserId, fetchEntitlement]);

  const toggleDevEntitlement = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      try {
        setIsLoading(true);
        const res = await inventoryApi.toggleDevEntitlement(enabled);
        const entitled = Boolean(res.entitled);
        setIsEntitled(entitled);
        setIsResolved(true);
        setStatus(entitled ? 'entitled' : 'unentitled');
        setMockMode(Boolean(res.mockMode));
        setError(null);
        return entitled;
      } catch (err: unknown) {
        console.error('Failed to toggle inventory entitlement:', err);
        const errMsg = err instanceof Error ? err.message : 'Failed to toggle dev entitlement';
        setError(errMsg);
        return isEntitled;
      } finally {
        setIsLoading(false);
      }
    },
    [isEntitled]
  );

  return (
    <InventoryEntitlementContext.Provider
      value={{
        isEntitled,
        isLoading,
        isResolved,
        status,
        mockMode,
        reason,
        error,
        practiceId: currentPracticeId,
        refetchEntitlement: fetchEntitlement,
        toggleDevEntitlement,
      }}
    >
      {children}
    </InventoryEntitlementContext.Provider>
  );
};

export function useInventoryEntitlement() {
  return useContext(InventoryEntitlementContext);
}

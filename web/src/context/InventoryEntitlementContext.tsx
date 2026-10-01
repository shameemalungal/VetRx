// ==============================================================================
// VetRx — InventoryEntitlementContext.tsx
// Evaluates server-side 'inventory_management' add-on entitlement state.
// Frontend is never source of truth; reflects backend entitlement response.
// ==============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { inventoryApi } from '../services/inventoryApi';
import { useAuth } from './AuthContext';

interface InventoryEntitlementContextType {
  isEntitled: boolean;
  isLoading: boolean;
  mockMode: boolean;
  reason?: string;
  refetchEntitlement: () => Promise<void>;
  toggleDevEntitlement: (enabled: boolean) => Promise<boolean>;
}

const InventoryEntitlementContext = createContext<InventoryEntitlementContextType>({
  isEntitled: false,
  isLoading: true,
  mockMode: false,
  refetchEntitlement: async () => {},
  toggleDevEntitlement: async () => false,
});

export const InventoryEntitlementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { practice, user } = useAuth();
  const [isEntitled, setIsEntitled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mockMode, setMockMode] = useState<boolean>(false);
  const [reason, setReason] = useState<string | undefined>(undefined);

  const fetchEntitlement = useCallback(async () => {
    if (!practice?.id || !user) {
      setIsEntitled(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await inventoryApi.getEntitlement();
      setIsEntitled(Boolean(res.entitled));
      setMockMode(Boolean(res.mockMode));
      setReason(res.reason);
    } catch (err) {
      // Backend error or not entitled -> safe default: false
      setIsEntitled(false);
    } finally {
      setIsLoading(false);
    }
  }, [practice?.id, user]);

  useEffect(() => {
    void fetchEntitlement();
  }, [fetchEntitlement]);

  const toggleDevEntitlement = useCallback(async (enabled: boolean): Promise<boolean> => {
    try {
      setIsLoading(true);
      const res = await inventoryApi.toggleDevEntitlement(enabled);
      setIsEntitled(Boolean(res.entitled));
      setMockMode(Boolean(res.mockMode));
      return Boolean(res.entitled);
    } catch (err) {
      console.error('Failed to toggle inventory entitlement:', err);
      return isEntitled;
    } finally {
      setIsLoading(false);
    }
  }, [isEntitled]);

  return (
    <InventoryEntitlementContext.Provider
      value={{
        isEntitled,
        isLoading,
        mockMode,
        reason,
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

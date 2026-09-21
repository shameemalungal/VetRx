// ==============================================================================
// VetRx — Frontend PermissionGate Component (Phase 14)
// Declarative UI guard for conditionally rendering content based on RBAC permissions/roles.
// NOTE: Frontend gates are UX enhancements only; backend authorization remains authoritative.
// ==============================================================================

import React from 'react';
import { useAuth } from '../../context/AuthContext';

export interface PermissionGateProps {
  permission?: string;
  role?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  role,
  fallback = null,
  children,
}) => {
  const { can, hasRole } = useAuth();

  if (permission && !can(permission)) {
    return <>{fallback}</>;
  }

  if (role && !hasRole(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

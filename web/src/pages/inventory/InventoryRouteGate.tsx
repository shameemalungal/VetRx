// =============================================================
// VetRx — InventoryRouteGate.tsx
// Route-level entitlement protection for the Inventory module.
// =============================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { useInventoryEntitlement } from '../../context/InventoryEntitlementContext';

interface InventoryRouteGateProps {
  children: React.ReactNode;
}

export const InventoryRouteGate: React.FC<InventoryRouteGateProps> = ({ children }) => {
  const { isEntitled, isLoading, reason, toggleDevEntitlement } = useInventoryEntitlement();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center', color: '#64748b' }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <span>Verifying Inventory & Stock Management entitlement...</span>
      </div>
    );
  }

  if (!isEntitled) {
    return (
      <div
        style={{
          maxWidth: '560px',
          margin: '60px auto',
          background: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          padding: '36px 32px',
          textAlign: 'center',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'rgba(0, 104, 95, 0.08)',
            color: 'var(--color-primary, #00685f)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
          }}
        >
          <Icon name="box" size={32} />
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
          Inventory Management Add-on Required
        </h2>

        <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.6, margin: '0 0 20px' }}>
          Inventory & Stock Management is an optional plug-in module for VetRx. Access requires an active
          base subscription and a valid <strong>inventory_management</strong> entitlement.
        </p>

        {reason && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: '12.5px',
              color: '#475569',
              marginBottom: '24px',
            }}
          >
            Entitlement status: <strong>{reason}</strong>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ height: '42px', justifyContent: 'center' }}
            onClick={async () => {
              await toggleDevEntitlement(true);
            }}
            id="btn-enable-inventory-dev"
          >
            Enable Inventory Add-on (Dev / Test Mode)
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ height: '42px', justifyContent: 'center' }}
            onClick={() => navigate('/dashboard')}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

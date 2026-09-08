// =============================================================
// VetRx — Stub page component
// Used for sections not yet implemented (Phases 2–7).
// =============================================================

import React from 'react';
import { Icon } from '../components/ui/Icon';

interface StubPageProps {
  title: string;
  icon: string;
  description?: string;
  phase: number;
}

export const StubPage: React.FC<StubPageProps> = ({
  title,
  icon,
  description,
  phase,
}) => (
  <div style={{ padding: 'var(--space-2xl) 0' }}>
    <div className="empty-state">
      <Icon name={icon} size={48} />
      <div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--text-headline-md)',
            fontWeight: 700,
            color: 'var(--color-text)',
            marginBottom: 'var(--space-xs)',
          }}
        >
          {title}
        </div>
        {description && (
          <div style={{ fontSize: 'var(--text-body-sm)', maxWidth: 320 }}>
            {description}
          </div>
        )}
        <div
          style={{
            marginTop: 'var(--space-sm)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-xs)',
            padding: '4px var(--space-sm)',
            background: 'var(--color-surface-container)',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--text-label-md)',
            color: 'var(--color-text-muted)',
          }}
        >
          Coming in Phase {phase}
        </div>
      </div>
    </div>
  </div>
);

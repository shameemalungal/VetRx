// =============================================================
// VetRx — VetRxLogo component
// Inline SVG of the teal cross + paw brand mark
// =============================================================

import React from 'react';

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

export const VetRxLogo: React.FC<LogoProps> = ({
  size = 32,
  showWordmark = true,
  className = '',
}) => {
  return (
    <div
      className={`vetrx-logo ${className}`}
      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
    >
      {/* Teal cross + paw icon */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Cross shape */}
        <rect x="13" y="2"  width="14" height="36" rx="4" fill="var(--color-primary)" opacity="0.15"/>
        <rect x="2"  y="13" width="36" height="14" rx="4" fill="var(--color-primary)" opacity="0.15"/>
        <rect x="13" y="2"  width="14" height="36" rx="4" stroke="var(--color-primary)" strokeWidth="2" fill="none"/>
        <rect x="2"  y="13" width="36" height="14" rx="4" stroke="var(--color-primary)" strokeWidth="2" fill="none"/>
        {/* Paw center pad */}
        <ellipse cx="20" cy="22" rx="5" ry="4.5" fill="var(--color-primary)"/>
        {/* Toe pads */}
        <circle cx="13.5" cy="17"   r="2.2" fill="var(--color-primary)"/>
        <circle cx="20"   cy="14.5" r="2.2" fill="var(--color-primary)"/>
        <circle cx="26.5" cy="17"   r="2.2" fill="var(--color-primary)"/>
      </svg>

      {showWordmark && (
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: size * 0.55 + 'px',
            fontWeight: 700,
            color: 'var(--color-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          VetRx
        </span>
      )}
    </div>
  );
};

// =============================================================
// VetRx — Canonical VetRxLogo component
// Source of truth: Stitch VetRx Brand Logo (teal cross + paw mark)
// =============================================================

import React from 'react';

export interface VetRxLogoProps {
  size?: number;
  showWordmark?: boolean;
  variant?: 'teal' | 'white' | 'inverse';
  className?: string;
  onClick?: () => void;
}

export const VetRxLogo: React.FC<VetRxLogoProps> = ({
  size = 32,
  showWordmark = true,
  variant = 'teal',
  className = '',
  onClick,
}) => {
  // Select the canonical Stitch asset
  let src = '/vetrx_logo_horizontal.png';
  if (showWordmark) {
    if (variant === 'white') {
      src = '/vetrx_logo_horizontal_white.png';
    } else if (variant === 'inverse') {
      src = '/vetrx_logo_horizontal_inverse.png';
    } else {
      src = '/vetrx_logo_horizontal.png';
    }
  } else {
    if (variant === 'white') {
      src = '/vetrx_logo_mark_white.png';
    } else if (variant === 'inverse') {
      src = '/vetrx_logo_mark_inverse.png';
    } else {
      src = '/vetrx_logo_mark.png';
    }
  }

  return (
    <div
      className={`vetrx-logo-canonical inline-flex items-center select-none ${className}`}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        lineHeight: 1,
      }}
    >
      <img
        src={src}
        alt="VetRx"
        style={{
          height: `${size}px`,
          width: 'auto',
          maxWidth: 'none',
          objectFit: 'contain',
          display: 'block',
        }}
        draggable={false}
      />
    </div>
  );
};

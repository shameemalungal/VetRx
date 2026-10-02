// =============================================================
// VetRx — platformDetect.ts
// Simple utility to detect mobile vs desktop devices.
// Used to route PDF generation: native print on desktop,
// html2canvas fallback on mobile.
// =============================================================

/**
 * Returns true if the current device is a mobile phone.
 * Tablets are treated as desktop (they have full print dialog support).
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  // Check user-agent for phone-specific keywords
  const mobileUA = /Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  // Fallback: touch device with narrow screen
  const smallTouchScreen = navigator.maxTouchPoints > 0 && window.innerWidth < 768;

  return mobileUA || smallTouchScreen;
}

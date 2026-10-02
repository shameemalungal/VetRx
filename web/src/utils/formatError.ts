// ==============================================================================
// VetRx — Centralized Safe Error Formatter (web/src/utils/formatError.ts)
// Prevents '[object Object]' or leaked stack traces from ever rendering in UI.
// ==============================================================================

export function formatApiError(err: unknown, fallbackMessage = 'An unexpected error occurred. Please try again.'): string {
  if (!err) return fallbackMessage;

  // Direct string handling
  if (typeof err === 'string') {
    const trimmed = err.trim();
    if (!trimmed || trimmed === '[object Object]' || trimmed === 'null' || trimmed === 'undefined') {
      return fallbackMessage;
    }
    return trimmed;
  }

  // Standard Error object handling
  if (err instanceof Error) {
    if (err.message && typeof err.message === 'string') {
      const msg = err.message.trim();
      if (msg && msg !== '[object Object]' && msg !== 'null' && msg !== 'undefined') {
        return msg;
      }
    }
    return fallbackMessage;
  }

  // Structured response / object handling
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;

    // 1. Check for backend standard { error: { message, code, details } }
    if (obj.error && typeof obj.error === 'object' && obj.error !== null) {
      const inner = obj.error as Record<string, unknown>;
      if (typeof inner.message === 'string' && inner.message.trim()) {
        let msg = inner.message.trim();
        if (Array.isArray(inner.details) && inner.details.length > 0) {
          const detailMsgs = inner.details
            .map((d: any) => (d && typeof d === 'object' ? d.message || d.path : String(d)))
            .filter(Boolean)
            .join(', ');
          if (detailMsgs) msg += ` (${detailMsgs})`;
        }
        return msg;
      }
      if (typeof inner.code === 'string' && inner.code.trim()) {
        return inner.code.replace(/_/g, ' ');
      }
    }

    // 2. Check for string error property { error: "..." }
    if (typeof obj.error === 'string' && obj.error.trim()) {
      const msg = obj.error.trim();
      if (msg !== '[object Object]') return msg;
    }

    // 3. Check for message property { message: "..." }
    if (typeof obj.message === 'string' && obj.message.trim()) {
      const msg = obj.message.trim();
      if (msg !== '[object Object]') return msg;
    }

    // 4. Check for statusText
    if (typeof obj.statusText === 'string' && obj.statusText.trim()) {
      return obj.statusText.trim();
    }
  }

  return fallbackMessage;
}

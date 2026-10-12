// ==============================================================================
// VetRx — Phone Normalization & Android Handoff Utility (web/src/utils/phoneUtils.ts)
// Canonical phone normalization, regex extraction, and fuzzy comparison.
// ==============================================================================

/**
 * Normalizes a phone number to standard digit format.
 * - Strips whitespace, hyphens, parentheses, periods, and leading '+'
 * - Normalizes Indian country code '+91' or '91' prefix for 10-digit mobiles
 * - Strips single leading '0' prefix commonly added in Android dialers
 * - Preserves international format where applicable
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = raw.trim().replace(/[\s\-\(\)\.]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Indian mobile numbers: 91 followed by 10 digits starting with 6-9
  if (cleaned.startsWith('91') && cleaned.length === 12 && /^[6-9]/.test(cleaned.substring(2))) {
    return cleaned.substring(2);
  }

  // Indian mobile with trunk prefix '0' e.g. 09876543210
  if (cleaned.startsWith('0') && cleaned.length === 11 && /^[6-9]/.test(cleaned.substring(1))) {
    return cleaned.substring(1);
  }

  return cleaned;
}

/**
 * Extracts a phone number from an arbitrary text string.
 * Used when receiving shared contacts or text from Android's Web Share Target
 * or extracting a copied phone number from Android dialer / clipboard.
 */
export function extractPhoneNumber(text: string): string | null {
  if (!text || typeof text !== 'string') return null;

  // 1. Look for Indian mobile format (+91 or 0 prefix optional, 10 digits starting 6-9)
  const mobileRegex = /(?:\+?91[\s\-]?)?(?:0)?([6-9]\d{4}[\s\-]?\d{5})/g;
  const match = mobileRegex.exec(text);
  if (match) {
    return normalizePhoneNumber(match[0]);
  }

  // 2. Look for explicit tel: URI
  if (text.startsWith('tel:')) {
    return normalizePhoneNumber(text.replace('tel:', ''));
  }

  // 3. General 10-15 digit string fallback
  const digitsOnly = text.replace(/\D/g, '');
  if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    if (digitsOnly.length === 10) return digitsOnly;
    return normalizePhoneNumber(digitsOnly);
  }

  return null;
}

/**
 * Compares two phone numbers to check if they represent the same party.
 * Matches exact normalized string or common 10-digit suffix.
 */
export function arePhonesMatching(phoneA: string, phoneB: string): boolean {
  if (!phoneA || !phoneB) return false;
  const normA = normalizePhoneNumber(phoneA);
  const normB = normalizePhoneNumber(phoneB);

  if (!normA || !normB) return false;
  if (normA === normB) return true;

  // Suffix check for 10-digit mobile equality
  const digitsA = phoneA.replace(/\D/g, '');
  const digitsB = phoneB.replace(/\D/g, '');

  if (digitsA.length >= 10 && digitsB.length >= 10) {
    return digitsA.slice(-10) === digitsB.slice(-10);
  }

  return false;
}

/**
 * Formats a phone number for user-friendly display in UI.
 * e.g. "9876543210" -> "+91 98765 43210"
 */
export function formatPhoneForDisplay(phone: string): string {
  const norm = normalizePhoneNumber(phone);
  if (norm.length === 10) {
    return `+91 ${norm.slice(0, 5)} ${norm.slice(5)}`;
  }
  return phone.trim();
}

// ==============================================================================
// VetRx — Backend Phone Normalization Utility (server/src/utils/phoneUtils.ts)
// ==============================================================================

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

export function extractPhoneNumber(text: string): string | null {
  if (!text || typeof text !== 'string') return null;

  const mobileRegex = /(?:\+?91[\s\-]?)?(?:0)?([6-9]\d{4}[\s\-]?\d{5})/g;
  const match = mobileRegex.exec(text);
  if (match) {
    return normalizePhoneNumber(match[0]);
  }

  const digitsOnly = text.replace(/\D/g, '');
  if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    if (digitsOnly.length === 10) return digitsOnly;
    return normalizePhoneNumber(digitsOnly);
  }

  return null;
}

export function arePhonesMatching(phoneA: string, phoneB: string): boolean {
  if (!phoneA || !phoneB) return false;
  const normA = normalizePhoneNumber(phoneA);
  const normB = normalizePhoneNumber(phoneB);

  if (!normA || !normB) return false;
  if (normA === normB) return true;

  const digitsA = phoneA.replace(/\D/g, '');
  const digitsB = phoneB.replace(/\D/g, '');

  if (digitsA.length >= 10 && digitsB.length >= 10) {
    return digitsA.slice(-10) === digitsB.slice(-10);
  }

  return false;
}

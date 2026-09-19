// =============================================================
// VetRx — documentFormat.ts
// Formatters for authoritative medical stationery documents:
// Invoices, Receipts, and Prescriptions.
// =============================================================

/**
 * Formats an invoice or receipt item description by removing clinical
 * administration instructions (e.g. "Give after food...", "Sig: ...", "Administer...")
 * while preserving brand name, strength, formulation, and commercial details.
 *
 * Example:
 * "sdfaS 1 mg (Give after food with drinking water. Complete full course.)" -> "sdfaS 1 mg"
 * "Amoxyclav Bolus Vet 3.3g (Sig: Give after meal)" -> "Amoxyclav Bolus Vet 3.3g"
 */
export function formatInvoiceItemDescription(rawDesc?: string | null): string {
  if (!rawDesc) return '';
  let text = String(rawDesc).trim();

  // Pattern 1: Parentheses containing clinical directions or Sig
  text = text.replace(
    /\s*\([^)]*(?:Sig\s*:|Give\b|Administer\b|Apply\b|Take\b|Instill\b|Mix\b|Inject\b|Feed\b|Complete full course|twice daily|once daily|after food|before food)[^)]*\)/gi,
    ''
  );

  // Pattern 2: Explicit "Sig:" clause outside parentheses
  text = text.replace(/\s*[-–—:]?\s*Sig\s*:.*$/gi, '');

  return text.trim();
}

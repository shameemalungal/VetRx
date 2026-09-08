# VetRx Antigravity Project Guide v1.0

Use this document as the single implementation specification for the VetRx test project.

## Core instruction
Build the VetRx veterinary practitioner web app and Android app from the approved Stitch screens and agreed requirements. Preserve the Stitch UI closely. Only polish where needed for usability, accessibility, consistency, or responsive behavior. Do not redesign major UI patterns.

## Scope
Home/Dashboard, Patients, Prescriptions, Treatment Packages, Medicines, Invoices, Settings.

The app is for private veterinary practitioners. Clinic/practice is OPTIONAL. An independent practitioner must work fully without a clinic. If no clinic is configured, omit clinic information entirely, with no blank placeholders.

Use Indian Rupees (₹) everywhere.

## Dashboard
Use the approved redesigned Stitch desktop and mobile dashboard. Primary action: New Prescription. Secondary actions: New Patient, New Invoice, Treatment Packages. Show compact counts for prescriptions, patients, packages and invoices, plus recent prescriptions, packages and invoices. Do not add ERP analytics, revenue/payment dashboards, inventory valuation, hospital occupancy, staff analytics, or online-consultation analytics.

## Patients
Owner: name, phone, email, address where available. Patient/animal: name, species, breed, sex, age/DOB where available, weight, identification/reference where applicable, notes. One owner may have multiple animals. Patient history should expose previous prescriptions and invoices.

## Prescriptions
Core workflow: Patient → Symptoms → Diagnosis → Medicines → Instructions/advice → Preview → Save/Issue.

Medicine fields: brand name, chemical/generic name, presentation, strength/volume where applicable, quantity, frequency, duration, route where applicable, directions/instructions, owner advice. Allow multiple medicines. Minimize typing/clicks.

Support save draft, issue/finalize, preview, print, PDF and share. Previous prescriptions can be viewed, reused as the basis of a NEW prescription, or saved as a package. Reuse must never modify historical prescriptions.

## Treatment Packages
Reusable prescribing templates containing medicines and instructions. Support create, edit, delete, view, apply, Save Current Prescription as Package, and Save Previous Prescription as Package. Applying a package copies its contents into the prescription. Editing a package later must not change existing prescriptions. If medicines already exist, show confirmation and never silently overwrite them.

## Medicines
Simple medicine master/reference: brand name, chemical/generic name, presentation, strength/volume and basic reference data. Do not build complex inventory/stock management.

## Invoices
Invoices are DOCUMENTS ONLY. No payment collection or payment system.

Support manual invoice creation, invoice from prescription, edit invoice, add/edit item, component selection, preview, save, issue, cancel, history, print, PDF and share.

Item categories: Medicine, Consultation Fee, Procedure Fee, Lab Fee, Travel Fee, Other.

Fields/calculation: quantity, unit price, discount, configurable tax where applicable, subtotal, discount total, tax total, grand total. Use decimal-safe money calculations and backend-authoritative totals.

Lifecycle: Draft → Issued; Draft or Issued may become Cancelled. Never use Paid, Pending Payment, Payment Method, UPI, cash/card collection, transaction ID, payment verification, settlement, payment gateway, payment reminder or outstanding balance.

Prescription → Create Invoice → Import billable items → Review/edit → Add services → Save/Issue → Preview → Print/PDF/Share. Invoice edits must never modify the prescription.

History search/filter: invoice number, owner, patient, phone, prescription number. Status filters: All, Issued, Draft, Cancelled. Issued invoices must not be silently overwritten. Cancelled invoices remain in history.

Invoice document: practitioner identity; optional clinic/practice identity; contact and registration/business details where configured; invoice number/date; owner; patient; prescription reference; itemized charges; quantity; rate; discount; tax; grand total; notes. If no clinic exists, omit that section.

Sharing: WhatsApp, Telegram, Email, Save PDF/share document. Sharing is document delivery only, never a payment request. PDF filename example: INV-2026-00125-Bruno.pdf.

## Audit
Keep a simple audit trail for important invoice events: created, item added/edited/removed, discount/tax changed, issued, cancelled, revision created, PDF generated, shared. Record user/timestamp where applicable.

## Data model
Core entities: Practitioner, optional Organization/Practice, Owner, Patient, Medicine, Prescription, PrescriptionItem, TreatmentPackage, TreatmentPackageItem, Invoice, InvoiceItem, AuditEvent.

Relationships: Patient belongs to Owner. Prescription belongs to Patient and Practitioner and may reference package usage. Invoice belongs to Patient, Owner and Practitioner and may reference Prescription. Organization/Practice association is optional and may be null.

## Integrity rules
1. Historical prescriptions never change when reused.
2. Applying a package copies its contents.
3. Package edits never alter existing prescriptions.
4. Invoice edits never alter prescriptions.
5. Issued invoices are not silently overwritten.
6. Cancelled invoices remain in history.
7. Invoice numbers are unique and never reused.
8. Backend recalculates invoice totals.
9. Clinic/practice is never mandatory.
10. No payment functionality anywhere.

## Responsive UI
Use approved Stitch desktop/mobile designs as the visual source of truth. Desktop may use sidebar and multi-column layouts. Mobile must be intentionally composed, with no desktop sidebar, no horizontal page scrolling, no clipped text, no overlapping controls, touch-friendly controls, and bottom navigation that never covers content. Test 375, 390 and 414 px widths. Do not substantially redesign approved mobile screens.

## UX
Optimize for a busy practitioner: minimal typing, minimal clicks, fast medicine selection, package reuse, previous-prescription reuse, clear defaults, keyboard-friendly desktop, thumb-friendly mobile. Avoid long forms, unnecessary modals and duplicate data entry.

## Implementation order
Phase 1: project setup, design system, navigation, practitioner settings.
Phase 2: patients.
Phase 3: medicines.
Phase 4: prescriptions.
Phase 5: treatment packages.
Phase 6: invoices.
Phase 7: PDF/print/share.
Phase 8: testing, responsive fixes and polish.

After each phase: run the app, test the workflow, fix errors, test desktop and mobile, then continue. Reuse components and models. Do not attempt a blind all-at-once implementation.

## Demo data
Use realistic veterinary data: Bruno/Labrador/Ahmed Kumar, Milo/Domestic Shorthair/Priya Nair, Luna/Golden Retriever/Rahul Menon. Packages: Canine Otitis, Canine Gastroenteritis, Skin Infection, Routine Deworming. Prescription examples RX-2026-0892, RX-2026-0891, RX-2026-0887. Invoice examples INV-2026-00125, INV-2026-00124, INV-2026-00123. Use ₹ only.

## Acceptance tests
Test independent practitioner with clinic blank and confirm documents contain no blank clinic section. Test practitioner with clinic. Test multi-medicine prescription, package creation/edit/application, previous prescription reuse, prescription-to-invoice workflow, all invoice item categories, discounts/tax, draft/issue/cancel, PDF/print/share, and mobile at 375/390/414 px.

## Antigravity behavior
Use the approved Stitch screens as the primary UI reference and this file as the functional source of truth. Keep the implementation simple. When unclear, prefer the Stitch UI, then this specification, then the simplest solution. Do not invent major features. Ask only when ambiguity blocks implementation or risks data loss. Fix root causes and avoid unrelated rewrites.

## Final success criterion
A private veterinary practitioner can open VetRx, select/create a patient, create a prescription quickly, reuse a package or previous prescription, generate an invoice, and print/PDF/share both documents with minimal steps. The app must remain close to the approved Stitch UI and must contain no payment system.

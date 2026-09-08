---
name: VetRx Design System
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3d4947'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6d7a77'
  outline-variant: '#bcc9c6'
  surface-tint: '#006a61'
  primary: '#00685f'
  on-primary: '#ffffff'
  primary-container: '#008378'
  on-primary-container: '#f4fffc'
  inverse-primary: '#6bd8cb'
  secondary: '#006398'
  on-secondary: '#ffffff'
  secondary-container: '#5bb8fe'
  on-secondary-container: '#00476e'
  tertiary: '#006947'
  on-tertiary: '#ffffff'
  tertiary-container: '#00855b'
  on-tertiary-container: '#f5fff6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#89f5e7'
  primary-fixed-dim: '#6bd8cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#005049'
  secondary-fixed: '#cce5ff'
  secondary-fixed-dim: '#93ccff'
  on-secondary-fixed: '#001d31'
  on-secondary-fixed-variant: '#004b73'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.005em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  space-xxs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-base: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
  space-2xl: 2rem
  space-3xl: 3rem
  gutter-compact: 0.75rem
  gutter-default: 1.25rem
  margin-screen: 1.5rem
---

## Brand & Style

This design system delivers an ultra-clean, clinical-grade productivity workspace engineered for private veterinary surgeons, technicians, and practice managers. Rooted in a high-efficiency philosophy—**minimum typing, minimum clicks, maximum clinical reuse**—the interface bridges the rigorous precision of medical informatics with the fluid elegance of modern SaaS.

### Visual Character
- **Atmosphere:** Serene, hyper-focused, and luminous. Interfaces rely on structured light neutrality to reduce cognitive load in fast-paced exam rooms and surgical suites.
- **Design Movement:** Modern Clinical Precision. Blends pristine container surfaces, micro-bordered structural grids, balanced typography, and purposeful medical accents.
- **Emotional Response:** Inspires absolute clinical confidence, swift decision-making, frictionless prescription entry, and administrative clarity under pressure.
- **Interaction Posture:** Rapid-fire action tags, dense yet scannable patient timelines, instant keyboard shortcuts, and tactile touch targets tuned for tablet-in-hand bedside consultations.

## Colors

The palette balances clinical legibility with precise functional coding. Light slate backdrops isolate pure white interactive modules, while high-chroma clinical pigments signal action states, pharmacological alerts, and billing validations.

### Primary Role & Surface Hierarchy
- **Clinical Primary (`#0D9488` Deep Medical Teal):** Primary actions, verified dose confirmations, active script submissions, and core navigation toggles.
- **Clinical Secondary (`#0284C7` Cyan Blue):** Secondary utilities, patient chart transitions, diagnostic attachments, and medication dosage calculators.
- **Clinical Tertiary / Validation (`#10B981` Vibrant Emerald):** Complete billing entries, cleared inventory levels, and successfully filled prescriptions.
- **Neutral Core (`#0F172A` Deep Slate):** Grounding neutral for high-contrast typography, structural icons, and focal emphasis.

### Contextual Status Accents
- **Amber Warning (`#F59E0B`):** Off-label drug warnings, controlled substance counters, dosage overrides, and pending client invoices.
- **Critical Red (`#EF4444`):** Allergy conflicts, contraindicated combinations, and critical credit/account holds.

### Neutral Layering Model
- **Base Canvas (`#F8FAFC` to `#F1F5F9`):** Outer viewport and structural application background.
- **Layer 1 Surface (`#FFFFFF`):** Workstation cards, data records, prescription pads, and patient summary panels.
- **Layer 2 Raised (`#FFFFFF`):** Flyout drawers, quick-prescribe modals, combobox popovers, and dosage selectors.
- **Structural Borders (`#E2E8F0`):** Crisp 1px perimeter definition on all cards, fields, and tabular rows.
- **Subdued Slate Borders (`#CBD5E1`):** Interactive inputs in focus-ready states and column dividers.

## Typography

Typography enforces instantaneous hierarchy between patient demographics, pharmaceutical units, and billing ledgers.

### Hierarchy & Typesetting Rules
- **Display & Section Headers (`Plus Jakarta Sans`):** Selected for its modern, confident geometric structure. Applied to views, patient banners, and clinical category sections with tight tracking (`-0.02em`).
- **Body & Clinical Prose (`Inter`):** Engineered for dense, ambiguous character differentiation (such as `l` vs `1`, `O` vs `0`), critical for medication names, concentrations, and administration frequencies.
- **Metrics, Dosages, and Financials (`JetBrains Mono`):** Dedicated to drug concentrations (e.g., `2.5 mg/kg PO q12h`), NDC codes, batch numbers, and line-item financial sums to ensure vertical tabular alignment.
- **Micro-Labels & Status Flags (`label-sm`):** Set in uppercase with `0.04em` letter spacing for immediate classification of animal species, prescription authorization levels, and invoice states.

## Layout & Spacing

The layout is built on a 12-column adaptive fluid grid structured around the physical realities of clinical exams: tablet touchscreens on mobile rounds and multi-pane high-resolution desktop terminals in pharmacy prep areas.

### Grid & Density Architecture
- **Standard Desktop (1280px+):** 12 columns, 20px (`space-lg`) gutters, 32px (`space-2xl`) outer margin. Tri-pane layout: 
  1. Patient Demographics & Signalment (280px fixed).
  2. Active Prescription & Treatment Builder (Fluid workspace).
  3. Real-time Itemized Ledger & Order Summary (360px fixed).
- **Tablet / Clinical Hybrid (768px - 1024px):** 8 columns, 16px (`space-base`) gutters, 20px outer margin. Dual-pane layout featuring an expandable slide-over ledger drawer to optimize form interaction.
- **Mobile Handheld (360px - 767px):** 4 columns, 12px (`space-md`) gutters, 16px outer margin. Vertical stacked execution with a sticky bottom summary dock for total cost and "Sign & Dispense" triggers.

### Spacing Rhythm
- **Micro Spacing (`0.25rem` - `0.5rem`):** Internal component padding, pill tags, dose adjustments, and stepper buttons.
- **Module Spacing (`0.75rem` - `1.25rem`):** Distance between field clusters, protocol tags, and line-item medications.
- **Section Spacing (`1.5rem` - `2rem`):** Separation between primary card modules (e.g., Diagnostics vs. Dispensing Logs).

## Elevation & Depth

Visual hierarchy uses a refined layered strategy combining pristine white surfaces, crisp 1px borders, and ultra-diffused atmospheric shadows. Avoid stark, high-contrast drop shadows; interface depth must evoke sterile, organized surfaces.

### Surface Elevation Tiers
- **Flat Ground (Level 0):** Background canvas (`#F8FAFC`). No shadow, no outline.
- **Card Base (Level 1):** White modules (`#FFFFFF`) framed with a 1px border (`#E2E8F0`) and a soft compound shadow:
  `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02);`
- **Raised Interactive (Level 2 - Hover / Active Lists):** Highlighted card rows and focused medical entries:
  `box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -2px rgba(15, 23, 42, 0.03);`
  Border shifts to `teal-200` (`#99F6E4`) or `slate-300` (`#CBD5E1`).
- **Floating Overlays (Level 3 - Quick Prescribe / Dose Calculators / Modals):**
  `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04);`
  Coupled with a soft backdrop blur: `backdrop-filter: blur(8px); background-color: rgba(15, 23, 42, 0.35);`

## Shapes

This design system uses a Level 2 (Rounded) geometry balanced by structured internal alignments. The exterior card envelopes appear approachable and modern, while internal clinical inputs maintain crisp utility.

### Radius Specifications
- **Enclosing Canvas Cards:** `rounded-2xl` (1rem / 16px) for master patient panels, pharmacy ledgers, and billing summaries.
- **Sub-cards & Interactive Groups:** `rounded-xl` (0.75rem / 12px) for itemized treatment blocks, dosage calculator groups, and drug info boxes.
- **Interactive Controls (Inputs, Buttons, Dropdowns):** `rounded-lg` (0.5rem / 8px) to maximize internal click-and-type boundaries.
- **Clinical Action Chips & Data Badges:** `rounded-full` (9999px) for single-tap protocol presets, allergen flags, and quick-add SIG instructions.

## Components

Components are optimized for extreme repetition and speed, prioritizing keyboard navigation, high-contrast touch targets, and instant re-use of standard protocols.

### Buttons & Quick Actions
- **Primary Clinical Action:** Background `#0D9488`, foreground white, font `label-lg`, height 44px (touch-compliant). Hover: `#0F766E`. Active: `#115E59`.
- **Secondary Protocol Button:** Background `#F1F5F9`, border 1px `#E2E8F0`, foreground `#0F172A`. Hover: `#E2E8F0`.
- **Destructive/Void Action:** Ghost button with `#EF4444` foreground, hover background `#FEF2F2`.
- **Speed Action Tag (Protocol Re-use):** Pill button, height 32px, `rounded-full`, subtle background `#CCFBF1`, text `#0F766E`, border 1px `#99F6E4`. Single-click populates drug, dosage, quantity, and billing codes instantly.

### Inputs & Dosage Calculators
- **Inputs:** Height 42px, background `#FFFFFF`, border 1px `#CBD5E1`, text `#0F172A`, font `body-md`. Focus state uses `#0D9488` border with `0 0 0 3px rgba(13, 148, 136, 0.15)` ring.
- **Combined Unit Fields:** Integrated numeric field paired with a segment control or selector for units (`mg`, `ml`, `tablets`, `drops`) in a unified, border-fused group.
- **Inline Math / Weight Scale Calculation:** Numeric fields support auto-math with patient weight pull-through (e.g., typing `/2` calculates half-dose based on active weight record).

### Prescription & Billing Cards
- **Container Architecture:** Outer boundary styled with `rounded-2xl`, background `#FFFFFF`, border 1px `#E2E8F0`, elevation Level 1.
- **Card Header:** Patient signalment (Species, Breed, Weight, Age) displayed in high-contrast data pills paired with owner ledger balances.
- **Prescription Item Row:** Distinct strip containing medication title (`headline-sm`), calculation logic, sig text (`body-sm`), inventory warning badge, and line-item price (`data-mono`).

### Data Chips & Clinical Status Badges
- **Allergy Alert Badge:** Background `#FEF2F2`, text `#991B1B`, border 1px `#F87171`, icon: warning triangle.
- **Controlled Substance Flag:** Background `#FEF3C7`, text `#92400E`, border 1px `#FBBF24`, bold text `Schedule II-IV`.
- **Dispensed / Paid Badge:** Background `#ECFDF5`, text `#065F46`, border 1px `#6EE7B7`.

### Selection Controls (Checkboxes & Radios)
- **Checkboxes:** Size 20x20px, `rounded-md` (4px), border 2px `#94A3B8`. Checked state fills `#0D9488` with white checkmark icon.
- **Radio Buttons:** Size 20x20px, circular, border 2px `#94A3B8`. Checked state creates `#0D9488` border ring with centered `#0D9488` active core dot.

### Specialized Clinical Utilities
- **Quick-SIG Selector:** A horizontal ribbon of common frequency pills (`q12h`, `q24h`, `q8h`, `PRN`, `with food`) allowing one-touch population into clinical instructions without manual typing.
- **Split-Billing Accordion:** Real-time dual billing calculator displaying clinic internal cost, markup margin, dispensing fee, and total client price with synchronized inline edits.
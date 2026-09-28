import React from 'react';

export const CoreFeatures: React.FC = () => {
  return (
    <section className="py-24 bg-surface-canvas scroll-reveal relative bg-tech-grid" data-purpose="core-features" id="features">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-soft text-teal-deep text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <span>Precision Features</span>
          </div>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-content-primary tracking-tight">
            Every tool engineered for veterinary medicine
          </h2>
          <p className="text-base sm:text-lg text-content-secondary mt-3 leading-relaxed">
            Not generic hospital software rebranded for pets. Built from the ground up for canine, feline, bovine, and mixed-species workflows.
          </p>
        </div>

        {/* Feature 1: Signalment */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center mb-24">
          <div className="lg:col-span-6 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-teal-soft text-teal-deep text-xs font-mono font-bold uppercase tracking-wider">
              <span>Patient Identification</span>
            </div>
            <h3 className="font-heading font-extrabold text-2xl sm:text-3xl lg:text-4xl text-content-primary tracking-tight">
              Owner &amp; Patient Animal Signalment
            </h3>
            <p className="text-sm sm:text-base text-content-secondary leading-relaxed font-sans">
              Record comprehensive biological and demographic profiles. Filter by species (Canine, Feline, Bovine, Caprine, Avian),
              breed standards, age, sterilization status, and microchip number without tedious manual typing.
            </p>
            <ul className="space-y-3 text-sm text-content-primary font-medium">
              <li className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full gradient-teal-aqua text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
                <span>Multi-pet ownership linked to a single client contact</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full gradient-teal-aqua text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
                <span>Weight recording with chronological clinical history</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full gradient-teal-aqua text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
                <span>Microchip and registry search for rapid lookup</span>
              </li>
            </ul>
          </div>
          <div className="lg:col-span-6">
            <div className="rounded-3xl border border-teal/20 bg-white p-6 sm:p-7 shadow-clinical hover-lift-card transition-all">
              <div className="flex items-center justify-between border-b border-clinical-border pb-4 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg gradient-teal-aqua p-0.5">
                    <div className="w-full h-full rounded-[6px] bg-white flex items-center justify-center text-xs">🐾</div>
                  </div>
                  <span className="font-mono text-xs font-bold text-teal-deep uppercase tracking-wider">Signalment Matrix</span>
                </div>
                <span className="text-xs font-mono bg-teal-50 border border-teal/20 px-2.5 py-1 rounded-full text-teal-deep font-semibold">
                  Registry #VET-9412
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-sans">
                <div className="bg-surface-canvas p-4 rounded-2xl border border-clinical-border/80">
                  <span className="text-content-muted block text-[10px] font-mono uppercase font-bold tracking-wider">SPECIES / BREED</span>
                  <span className="font-heading font-extrabold text-content-primary text-sm mt-1 block">Canine • Golden Retriever</span>
                </div>
                <div className="bg-surface-canvas p-4 rounded-2xl border border-clinical-border/80">
                  <span className="text-content-muted block text-[10px] font-mono uppercase font-bold tracking-wider">WEIGHT / STATUS</span>
                  <span className="font-heading font-extrabold text-content-primary text-sm mt-1 block">28.0 kg • Male Spayed</span>
                </div>
                <div className="bg-surface-canvas p-4 rounded-2xl border border-clinical-border/80">
                  <span className="text-content-muted block text-[10px] font-mono uppercase font-bold tracking-wider">PRIMARY GUARDIAN</span>
                  <span className="font-heading font-extrabold text-content-primary text-sm mt-1 block">Rahul Menon (+91 98470)</span>
                </div>
                <div className="bg-surface-canvas p-4 rounded-2xl border border-clinical-border/80">
                  <span className="text-content-muted block text-[10px] font-mono uppercase font-bold tracking-wider">CLINICAL NOTE</span>
                  <span className="font-heading font-extrabold text-content-primary text-sm mt-1 block">Routine Otitis Follow-up</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 2: Prescription & Dosing */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center mb-24">
          <div className="lg:col-span-6 lg:order-2 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-sky-soft text-sky-blue text-xs font-mono font-bold uppercase tracking-wider">
              <span>Clinical Formulary</span>
            </div>
            <h3 className="font-heading font-extrabold text-2xl sm:text-3xl lg:text-4xl text-content-primary tracking-tight">
              Rapid Prescription &amp; Formulary Dosing
            </h3>
            <p className="text-sm sm:text-base text-content-secondary leading-relaxed font-sans">
              Standardize dosing accurately. The VetRx formulary supports calibrated mg/kg guidelines translated into clear liquid
              volumes (ml), tablet counts, and administration routes tailored to the animal&apos;s recorded weight.
            </p>
            <ul className="space-y-3 text-sm text-content-primary font-medium">
              <li className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-sky-blue text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
                <span>Pre-configured formulary with standard veterinary brands</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-sky-blue text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
                <span>Multi-drug SIG instructions automatically formatted for pet owners</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-sky-blue text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
                <span>Fast keyboard-friendly inputs for busy consultation bays</span>
              </li>
            </ul>
          </div>
          <div className="lg:col-span-6 lg:order-1">
            <div className="rounded-3xl border border-sky-blue/20 bg-white p-6 sm:p-7 shadow-clinical space-y-4 hover-lift-card transition-all">
              <div className="flex items-center justify-between border-b border-clinical-border pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-soft text-sky-blue flex items-center justify-center text-xs font-bold">💊</div>
                  <span className="font-mono text-xs font-bold text-sky-blue uppercase tracking-wider">Calibrated Dosage</span>
                </div>
                <span className="text-xs font-mono text-clinical-success font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Matched: 28.0 kg Canine
                </span>
              </div>
              <div className="p-4 bg-teal-soft/40 rounded-2xl border border-teal/20 text-xs">
                <div className="flex justify-between font-heading font-extrabold text-content-primary text-sm">
                  <span>Meloxicam Oral Suspension 1.5 mg/ml</span>
                  <span className="text-teal-deep font-mono">0.2 mg/kg Init</span>
                </div>
                <p className="text-content-secondary mt-1.5 leading-relaxed font-sans">
                  Day 1: Give 3.7 ml with food. Day 2 onwards: Give 1.85 ml once daily.
                </p>
                <div className="mt-3 flex gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-white text-[11px] font-mono border border-clinical-border font-medium">
                    Duration: 5 Days
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white text-[11px] font-mono border border-clinical-border font-medium">
                    Route: Oral
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 3: Treatment Packages */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center mb-24">
          <div className="lg:col-span-6 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-violet-soft text-violet text-xs font-mono font-bold uppercase tracking-wider">
              <span>Clinical Efficiency</span>
            </div>
            <h3 className="font-heading font-extrabold text-2xl sm:text-3xl lg:text-4xl text-content-primary tracking-tight">
              Pre-Calibrated Treatment Packages
            </h3>
            <p className="text-sm sm:text-base text-content-secondary leading-relaxed font-sans">
              Standardize and accelerate routine case consultations. Apply complete clinical protocols with one click for common
              conditions such as Canine Otitis, Acute Gastroenteritis, Dermatitis, and Vaccination Protocols.
            </p>
            <ul className="space-y-3 text-sm text-content-primary font-medium">
              <li className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-violet text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
                <span>Create custom clinic-specific bundles with your preferred drugs</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-violet text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
                <span>Instantly loads diagnostics, medications, and standard owner care notes</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-violet text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
                <span>Easily modify individual items before finalizing the visit</span>
              </li>
            </ul>
          </div>
          <div className="lg:col-span-6">
            <div className="rounded-3xl border border-violet/20 bg-white p-6 sm:p-7 shadow-clinical space-y-4 hover-lift-card transition-all">
              <div className="text-xs font-mono text-violet font-bold uppercase tracking-wider flex items-center gap-2">
                <span>📋 Protocol Library Preview</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div className="p-4 rounded-2xl border border-clinical-border bg-surface-canvas hover:border-violet/40 transition-colors flex items-center justify-between">
                  <div>
                    <div className="text-sm font-heading font-bold text-content-primary">Canine Acute Gastroenteritis</div>
                    <div className="text-xs text-content-secondary mt-0.5">Antiemetic + Probiotic + Rehydration + Gastric protectant</div>
                  </div>
                  <span className="text-xs font-mono font-bold text-violet px-3 py-1 bg-white rounded-xl border border-violet/20 shadow-xs">
                    4 Items
                  </span>
                </div>
                <div className="p-4 rounded-2xl border border-clinical-border bg-surface-canvas hover:border-violet/40 transition-colors flex items-center justify-between">
                  <div>
                    <div className="text-sm font-heading font-bold text-content-primary">Feline Upper Respiratory Protocol</div>
                    <div className="text-xs text-content-secondary mt-0.5">Antibiotic + Nebulization + Supportive care</div>
                  </div>
                  <span className="text-xs font-mono font-bold text-violet px-3 py-1 bg-white rounded-xl border border-violet/20 shadow-xs">
                    3 Items
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 4 & 5: Invoices & Admin */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 sm:p-10 rounded-3xl bg-white border border-warm-accent/30 shadow-clinical space-y-4 hover-lift-card transition-all">
            <div className="w-12 h-12 rounded-2xl bg-warm-soft text-amber-700 flex items-center justify-center font-mono font-extrabold text-xl shadow-xs">
              ₹
            </div>
            <h3 className="font-heading font-extrabold text-2xl text-content-primary">
              Itemized Invoices &amp; Tax Receipts (₹ INR)
            </h3>
            <p className="text-sm text-content-secondary leading-relaxed font-sans">
              Generate formal, print-ready clinic receipts in seconds. Itemize procedures, consultations, clinical consumables, and
              pharmacy items in Indian Rupees with direct ledger control.
            </p>
            <div className="pt-3 text-xs font-mono text-teal-deep font-semibold">
              ✓ Printable A4 / A5 clean receipts • Share-ready PDF export
            </div>
          </div>

          <div className="p-8 sm:p-10 rounded-3xl bg-white border border-teal/20 shadow-clinical space-y-4 hover-lift-card transition-all">
            <div className="w-12 h-12 rounded-2xl gradient-teal-aqua text-white flex items-center justify-center font-bold shadow-xs">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
            <h3 className="font-heading font-extrabold text-2xl text-content-primary">
              Practice Administration &amp; Multi-Doctor Approvals
            </h3>
            <p className="text-sm text-content-secondary leading-relaxed font-sans">
              Manage clinical team members, permissions, prescription approval workflows, revision histories, and practice profile settings
              from a centralized console.
            </p>
            <div className="pt-3 text-xs font-mono text-teal-deep font-semibold">
              ✓ Multi-doctor review workflows • Complete audit trail logging
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};


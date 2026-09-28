import React, { useState } from 'react';

export const CommandDeskShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rx' | 'package' | 'billing'>('rx');

  return (
    <section className="py-24 bg-surface-canvas overflow-hidden scroll-reveal relative bg-dots-pattern" data-purpose="product-visual-showcase">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-soft text-teal-deep text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <span>Central Clinical Desk</span>
          </div>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-content-primary tracking-tight">
            Designed for speed during consultations
          </h2>
          <p className="text-base sm:text-lg text-content-secondary mt-3 leading-relaxed">
            Every critical patient detail, formulary guideline, and historical dispense record is available within single-click reach.
          </p>
        </div>

        <div className="relative max-w-5xl mx-auto">
          {/* Ambient Glow behind command center */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-3/4 h-32 glow-teal-large blur-3xl pointer-events-none -z-10"></div>

          <div className="rounded-3xl border border-teal/20 bg-white shadow-hero-glow p-5 sm:p-8">
            {/* Top Toolbar */}
            <div className="border-b border-clinical-border pb-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-clinical-success"></span>
                  </span>
                  <h3 className="font-heading font-extrabold text-xl text-content-primary">Clinical Command Desk</h3>
                  <span className="text-xs font-mono gradient-teal-aqua text-white px-2.5 py-0.5 rounded-full font-bold shadow-xs">
                    Live Mode
                  </span>
                </div>
                <p className="text-xs text-content-secondary mt-1 font-mono">
                  Prescription Station Bay 3 • Vet Clinic Practice
                </p>
              </div>

              {/* Quick Filter Search Bar */}
              <div className="relative min-w-[280px]">
                <input
                  className="w-full text-xs font-mono pl-9 pr-3 py-2.5 rounded-xl border border-clinical-border bg-surface-canvas focus:ring-2 focus:ring-teal/30 focus:border-teal transition-all"
                  placeholder="Lookup medicine (e.g. Meloxicam, Amoxicillin)..."
                  readOnly
                  type="text"
                  value="Lookup medicine (e.g. Meloxicam, Amoxicillin)..."
                />
                <svg className="w-4 h-4 text-teal absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* View Selector Tabs */}
            <div className="flex items-center gap-2 mb-6 border-b border-clinical-border/60 pb-3 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('rx')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'rx'
                    ? 'gradient-teal-aqua text-white shadow-xs'
                    : 'bg-surface-subtle text-content-secondary hover:text-content-primary'
                }`}
              >
                <span>💊 Prescription Mode</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('package')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'package'
                    ? 'gradient-teal-aqua text-white shadow-xs'
                    : 'bg-surface-subtle text-content-secondary hover:text-content-primary'
                }`}
              >
                <span>📦 Treatment Bundles</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('billing')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'billing'
                    ? 'gradient-teal-aqua text-white shadow-xs'
                    : 'bg-surface-subtle text-content-secondary hover:text-content-primary'
                }`}
              >
                <span>₹ Itemized Ledger</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (8 cols): Patient Profile & Formulary Rows */}
              <div className="lg:col-span-8 space-y-5">
                {/* Active Patient Card */}
                <div className="p-5 rounded-2xl bg-teal-soft/40 border border-teal/30 flex items-start justify-between relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-teal/5 rounded-full blur-xl pointer-events-none"></div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-teal-deep font-extrabold">
                        Selected Patient Record
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-teal"></span>
                      <span className="text-[10px] font-mono text-content-muted">Weight Calibrated</span>
                    </div>
                    <div className="font-heading font-extrabold text-xl text-content-primary">Luna (Golden Retriever)</div>
                    <div className="text-xs text-content-secondary mt-0.5 font-medium">
                      Canine • Female Spayed • 28.0 kg • Microchip: 981098102381
                    </div>
                    <div className="text-xs font-mono text-content-muted mt-1.5">
                      Owner: Rahul Menon • +91 98470 xxxxx • Palakkad, Kerala
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full gradient-teal-aqua text-white text-xs font-heading font-bold shadow-xs">
                    Active Visit
                  </span>
                </div>

                {/* Formulary & Dosage Table */}
                <div className="border border-clinical-border rounded-2xl p-5 bg-white space-y-3.5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-clinical-border pb-3">
                    <span className="text-xs font-heading font-extrabold text-content-primary uppercase tracking-wider">
                      Prescribed Formulary &amp; Dosage
                    </span>
                    <span className="text-[11px] font-mono text-teal-deep font-semibold bg-teal-50 px-2 py-0.5 rounded-md border border-teal/20">
                      Weight band: 25-30kg calibrated
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {/* Item 1 */}
                    <div className="p-3.5 rounded-xl bg-surface-canvas border border-clinical-border hover:border-teal/30 transition-colors flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-bold text-content-primary text-sm">
                            1. Amoxicillin &amp; Clavulanate 625mg
                          </span>
                          <span className="text-[10px] font-mono bg-emerald-50 text-clinical-success px-1.5 py-0.2 rounded font-bold">
                            Antibacterial
                          </span>
                        </div>
                        <p className="text-content-secondary text-[11px] mt-0.5 font-sans">
                          1 tab PO twice daily after meals • 7 Days (14 Tabs)
                        </p>
                      </div>
                      <span className="text-[11px] font-mono text-teal-deep font-bold bg-white px-2 py-1 rounded-lg border border-clinical-border">
                        Oral Solid
                      </span>
                    </div>

                    {/* Item 2 */}
                    <div className="p-3.5 rounded-xl bg-surface-canvas border border-clinical-border hover:border-teal/30 transition-colors flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-bold text-content-primary text-sm">
                            2. Posatex Otic Drops
                          </span>
                          <span className="text-[10px] font-mono bg-sky-soft text-sky-blue px-1.5 py-0.2 rounded font-bold">
                            Topical
                          </span>
                        </div>
                        <p className="text-content-secondary text-[11px] mt-0.5 font-sans">
                          4 drops into affected ear canal once daily • 10 Days
                        </p>
                      </div>
                      <span className="text-[11px] font-mono text-teal-deep font-bold bg-white px-2 py-1 rounded-lg border border-clinical-border">
                        Topical Otic
                      </span>
                    </div>
                  </div>
                </div>

                {/* Veterinary Advice Box */}
                <div className="p-4 bg-surface-canvas rounded-xl border border-clinical-border text-xs text-content-secondary flex items-start gap-2.5">
                  <span className="text-teal text-base">💡</span>
                  <div>
                    <span className="font-heading font-bold text-content-primary">Veterinary Advice: </span>
                    Ear cleaning protocol with gentle saline 15 minutes before administering otic drops. Review after 10 days.
                  </div>
                </div>
              </div>

              {/* Right Column (4 cols): Applied Package & Ledger */}
              <div className="lg:col-span-4 space-y-4">
                {/* Applied Package Card */}
                <div className="p-5 rounded-2xl border border-violet/30 bg-white shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-heading font-bold text-content-primary">Applied Package</span>
                    <span className="text-[10px] font-mono bg-violet-soft text-violet px-2 py-0.5 rounded-full font-bold">
                      Bundle
                    </span>
                  </div>
                  <div className="text-sm font-heading font-extrabold text-teal-deep">Canine Otitis Protocol</div>
                  <p className="text-[11px] text-content-secondary mt-1 leading-relaxed">
                    Pre-calibrated 2 medicines, dosage guidelines, follow-up scheduler.
                  </p>
                </div>

                {/* Clinical Ledger Summary Card */}
                <div className="p-5 rounded-2xl border border-clinical-border bg-white space-y-3.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-heading font-extrabold text-content-primary block uppercase tracking-wider">
                      Clinical Ledger Summary
                    </span>
                    <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-bold">
                      INR ₹
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-content-secondary">
                      <span>Consultation &amp; Exam</span>
                      <span className="font-mono font-medium">₹400.00</span>
                    </div>
                    <div className="flex justify-between text-content-secondary">
                      <span>Dispensed Medicines</span>
                      <span className="font-mono font-medium">₹1,150.00</span>
                    </div>
                    <div className="flex justify-between text-content-secondary">
                      <span>Ear Swab Cytology</span>
                      <span className="font-mono font-medium">₹250.00</span>
                    </div>
                    <div className="pt-2.5 border-t border-clinical-border flex justify-between font-extrabold text-content-primary text-base">
                      <span>Total Amount</span>
                      <span className="font-mono text-teal-deep">₹1,800.00</span>
                    </div>
                  </div>

                  <div className="pt-2 text-center text-xs font-heading font-bold text-teal-deep bg-teal-soft/50 py-2.5 rounded-xl border border-teal/25">
                    ✓ Print-Ready Prescription &amp; Invoice
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};


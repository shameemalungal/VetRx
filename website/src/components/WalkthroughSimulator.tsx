import React, { useState } from 'react';

interface Stage {
  label: string;
  badge: string;
  timer: string;
  title: string;
  desc: string;
  preview: React.ReactNode;
}

export const WalkthroughSimulator: React.FC = () => {
  const [activeStage, setActiveStage] = useState(0);

  const stages: Stage[] = [
    {
      label: '0-5s: Dashboard',
      badge: 'Stage 1 of 5 • Active Command Desk',
      timer: '0:04 / 0:30s',
      title: 'Clinical Workspace Overview',
      desc: "The practitioner opens VetRx. Today's 15 prescriptions, active outpatient list, and recent invoices are immediately visible with zero page reloads.",
      preview: (
        <div className="space-y-2.5 text-xs font-mono">
          <div className="flex justify-between items-center text-content-secondary bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
            <span className="font-semibold text-content-primary">[DOCTOR]: Dr. Practitioner (BVSc &amp; AH)</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              STATION BAY 3 ONLINE
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span className="text-content-secondary">Queue: 4 Patients Waiting • Bruno (Labrador), Milo (Cat), Daisy (Beagle)</span>
            <span className="text-teal font-extrabold bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200/60 shrink-0">Alt + N Quick Start</span>
          </div>
        </div>
      ),
    },
    {
      label: '5-10s: Patient',
      badge: 'Stage 2 of 5 • Animal Signalment',
      timer: '0:09 / 0:30s',
      title: 'Instant Patient & Owner Lookup',
      desc: 'Type the client phone or pet name. Instantly view species, breed, age, sterilization status, and previous weight timeline.',
      preview: (
        <div className="space-y-2.5 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-teal-dark text-sm">Bruno (Labrador Retriever)</span> • 28.0 kg (Recorded Today)
              <div className="text-[11px] text-content-secondary mt-0.5">Owner: Ahmed Kumar (+91 98470 xxxxx)</div>
            </div>
            <span className="text-xs bg-gradient-to-r from-teal-soft to-mint text-teal-dark px-3 py-1 rounded-md font-extrabold border border-teal-200/60 shadow-2xs">
              Signalment Confirmed
            </span>
          </div>
        </div>
      ),
    },
    {
      label: '10-15s: Create Rx',
      badge: 'Stage 3 of 5 • Formulary Dosing',
      timer: '0:14 / 0:30s',
      title: 'Weight-Calibrated Formulary Prescribing',
      desc: 'Select medicines from the veterinary catalog. Enter frequency, duration, and instructions formatted automatically for pet owners.',
      preview: (
        <div className="space-y-2.5 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-content-primary text-sm">Amoxicillin &amp; Clavulanate 625mg</span>
              <div className="text-[11px] text-content-secondary mt-0.5">1 tab PO twice daily • 7 Days (14 Tabs Total)</div>
            </div>
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              ✓ Dose Matched
            </span>
          </div>
        </div>
      ),
    },
    {
      label: '15-20s: History',
      badge: 'Stage 4 of 5 • Packages & Clinical History',
      timer: '0:19 / 0:30s',
      title: 'Apply Standard Treatment Protocol',
      desc: 'One-click load pre-configured treatment packages like Canine Otitis or Gastroenteritis, bringing standard procedures and follow-up notes.',
      preview: (
        <div className="space-y-2.5 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-teal-dark text-sm">Bundle: Canine Otitis Protocol</span>
              <div className="text-[11px] text-content-secondary mt-0.5">2 Medicines + Ear Cleaning Advice + 10-day review</div>
            </div>
            <span className="text-xs bg-gradient-to-r from-teal-soft to-mint text-teal-dark px-3 py-1 rounded-md font-extrabold border border-teal-200/60 shadow-2xs">
              Package Applied
            </span>
          </div>
        </div>
      ),
    },
    {
      label: '20-30s: Summary',
      badge: 'Stage 5 of 5 • Complete & Print',
      timer: '0:29 / 0:30s',
      title: 'Print Prescription & Invoice',
      desc: 'Finalize the visit. Generate clean clinical letterhead PDF and itemized INR invoice ready for client handover or printing.',
      preview: (
        <div className="space-y-2.5 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-content-primary text-sm">Prescription #RX-2026-0987 &amp; Receipt</span>
              <div className="text-[11px] text-content-secondary mt-0.5">Itemized: ₹1,800.00 • PDF Generated &amp; Saved</div>
            </div>
            <span className="text-emerald-700 font-extrabold bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
              ✓ Visit Complete
            </span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section className="py-28 bg-gradient-to-b from-[#F6FAFA] via-white to-[#F0F7F7] relative overflow-hidden scroll-reveal" data-purpose="walkthrough-simulator" id="walkthrough">
      {/* Decorative ambient elements */}
      <div className="absolute top-1/3 -right-32 w-80 h-80 bg-teal/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200/60 text-teal-800 text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-teal animate-gentle-pulse" />
            Guided Simulation
          </div>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-content-primary mt-2 tracking-tight">
            See VetRx in action.
          </h2>
          <p className="text-base sm:text-lg text-content-secondary mt-3 leading-relaxed">
            30 seconds is enough to see how VetRx can simplify your everyday consultation workflow.
          </p>
        </div>

        {/* Simulator Shell */}
        <div className="max-w-4xl mx-auto rounded-3xl border border-slate-200/80 bg-white/95 backdrop-blur-md shadow-card-lift overflow-hidden">
          {/* Interactive 5-stage scrubber bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-mono text-center">
            {stages.map((stg, idx) => (
              <button
                key={stg.label}
                type="button"
                onClick={() => setActiveStage(idx)}
                className={`py-3.5 px-2 border-b-2 transition-all duration-200 ${
                  activeStage === idx
                    ? 'border-teal bg-white font-bold text-teal-dark shadow-xs'
                    : 'border-transparent text-content-secondary hover:bg-white/60 hover:text-content-primary'
                }`}
              >
                <span className="inline-block">{stg.label}</span>
              </button>
            ))}
          </div>

          {/* Simulated Screen Display Box */}
          <div className="p-6 sm:p-10 min-h-[360px] flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-lg bg-teal-50 border border-teal-200/60 text-teal-800 font-mono text-xs font-bold shadow-2xs">
                  {stages[activeStage].badge}
                </span>
                <span className="text-xs font-mono text-content-secondary bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                  {stages[activeStage].timer}
                </span>
              </div>
              <h3 className="font-heading font-extrabold text-2xl sm:text-3xl text-content-primary tracking-tight">
                {stages[activeStage].title}
              </h3>
              <p className="text-sm sm:text-base text-content-secondary leading-relaxed max-w-2xl">
                {stages[activeStage].desc}
              </p>

              {/* Dynamic UI Canvas Mockup */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-[#F6FAFA] border border-slate-200/70 shadow-inner">
                {stages[activeStage].preview}
              </div>
            </div>

            {/* Bottom Play / Navigation controls */}
            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
              <div className="text-xs font-heading font-semibold text-content-secondary italic">
                &ldquo;Simplify your practice. Focus on better treatment.&rdquo;
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveStage(Math.max(0, activeStage - 1))}
                  disabled={activeStage === 0}
                  className={`px-4 py-2 rounded-xl border border-slate-200 text-xs font-heading font-bold transition-all ${
                    activeStage === 0
                      ? 'opacity-40 cursor-not-allowed text-content-muted bg-slate-50'
                      : 'text-content-secondary hover:bg-slate-100 hover:text-content-primary active:scale-95'
                  }`}
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStage(Math.min(stages.length - 1, activeStage + 1))}
                  disabled={activeStage === stages.length - 1}
                  className={`px-5 py-2 rounded-xl text-xs font-heading font-bold transition-all shadow-xs ${
                    activeStage === stages.length - 1
                      ? 'opacity-40 cursor-not-allowed bg-teal/40 text-white'
                      : 'bg-gradient-to-r from-teal to-teal-dark hover:from-teal-dark hover:to-teal text-white hover:shadow-hero-glow active:scale-95'
                  }`}
                >
                  Next Step →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

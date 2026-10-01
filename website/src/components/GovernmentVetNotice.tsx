import React from 'react';

export const GovernmentVetNotice: React.FC = () => {
  return (
    <section className="py-24 bg-surface-canvas border-y border-clinical-border scroll-reveal relative" data-purpose="government-vets">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-white border border-teal/20 shadow-clinical relative overflow-hidden">
          {/* Subtle background ambient glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-teal-soft/60 rounded-full blur-3xl pointer-events-none -z-0"></div>

          <div className="max-w-3xl relative z-10 space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full gradient-teal-aqua text-white text-xs font-mono font-bold uppercase tracking-wider shadow-xs">
              <span>Permitted Private Practice Workflows</span>
            </div>

            <h3 className="font-heading font-extrabold text-2xl sm:text-3xl lg:text-4xl text-content-primary tracking-tight">
              Supports permitted private-practice workflows
            </h3>

            <p className="text-sm sm:text-base text-content-secondary leading-relaxed font-sans">
              Government veterinary officers may use VetRx for private-practice workflows where such practice is permitted under applicable government orders, service rules, and permissions. VetRx supports invoice workflows that can accommodate applicable State Government prescribed private-practice service rates.
            </p>

            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs text-content-primary font-medium">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-canvas border border-clinical-border/80">
                <span className="w-5 h-5 rounded-full gradient-teal-aqua text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
                <span>Distinct personal clinical records</span>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-canvas border border-clinical-border/80">
                <span className="w-5 h-5 rounded-full gradient-teal-aqua text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
                <span>Fast mobile consultation mode for evening clinics</span>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-canvas border border-clinical-border/80">
                <span className="w-5 h-5 rounded-full gradient-teal-aqua text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
                <span>Individual practice receipts and invoices</span>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-canvas border border-clinical-border/80">
                <span className="w-5 h-5 rounded-full gradient-teal-aqua text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
                <span>Isolated cloud database architecture</span>
              </div>
            </div>

            {/* Required Statutory & Professional Responsibility Notice */}
            <div className="mt-8 p-5 rounded-2xl bg-teal-50/60 border border-teal/30 text-xs text-content-secondary leading-relaxed shadow-xs">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-teal text-sm">⚖️</span>
                <span className="font-heading font-extrabold text-teal-deep uppercase text-[11px] tracking-wider">
                  Notice on Practice Permissions
                </span>
              </div>
              <p className="font-sans">
                Practitioners are responsible for complying with applicable service rules, permissions and government orders.
                VetRx does not provide legal or regulatory compliance guarantees.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};


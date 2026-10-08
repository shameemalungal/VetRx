import React from 'react';

export const WhyVetRx: React.FC = () => {
  return (
    <section className="py-28 bg-gradient-to-b from-white via-[#F6FAFA] to-white text-content-primary relative overflow-hidden scroll-reveal" data-purpose="why-vetrx" id="about">
      {/* Background tech glow effects */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-teal/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-96 h-96 bg-aqua/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-tech-grid opacity-[0.03] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200/60 text-teal-800 text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-teal animate-gentle-pulse" />
            Authentic Clinical Heritage
          </div>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-content-primary tracking-tight mt-2">
            Built in India. Designed around real veterinary practice.
          </h2>
          <p className="text-base sm:text-lg text-content-secondary mt-4 leading-relaxed font-normal">
            VetRx is developed by veterinary doctors with 15+ years of clinical experience, with a simple objective:
            reduce the administrative burden around practice so veterinarians can focus more attention on clinical care.
          </p>
        </div>

        {/* 4 Confirmed Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-clinical-border hover:border-teal/50 hover:bg-teal-50/20 shadow-xs hover:shadow-card-lift transition-all duration-300 hover-lift-card group">
            <div className="w-12 h-12 rounded-xl bg-teal-soft border border-teal/20 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              🩺
            </div>
            <h3 className="font-heading font-bold text-base text-content-primary group-hover:text-teal-deep transition-colors">
              Veterinarian-Led
            </h3>
            <p className="text-xs text-content-secondary mt-2.5 leading-relaxed">
              Designed by practicing clinicians who understand the pressure of outpatient volume, animal restraint, and rapid decision-making.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-clinical-border hover:border-sky-300 hover:bg-sky-50/20 shadow-xs hover:shadow-card-lift transition-all duration-300 hover-lift-card group">
            <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              🐕
            </div>
            <h3 className="font-heading font-bold text-base text-content-primary group-hover:text-sky-700 transition-colors">
              Veterinary-Specific
            </h3>
            <p className="text-xs text-content-secondary mt-2.5 leading-relaxed">
              Tailored specifically around multi-species dosage formulas, microchip identifiers, vaccination schedules, and veterinary formulary drugs.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-clinical-border hover:border-emerald-300 hover:bg-emerald-50/20 shadow-xs hover:shadow-card-lift transition-all duration-300 hover-lift-card group">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              🌴
            </div>
            <h3 className="font-heading font-bold text-base text-content-primary group-hover:text-emerald-700 transition-colors">
              Built in India (Kerala-Origin)
            </h3>
            <p className="text-xs text-content-secondary mt-2.5 leading-relaxed">
              Rooted in Kerala&apos;s clinical ecosystem, built around Indian veterinary medicine brands, pricing realities, and local clinic workflows.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-clinical-border hover:border-amber-300 hover:bg-amber-50/20 shadow-xs hover:shadow-card-lift transition-all duration-300 hover-lift-card group">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              ⚙️
            </div>
            <h3 className="font-heading font-bold text-base text-content-primary group-hover:text-amber-800 transition-colors">
              Designed Around Real Practice
            </h3>
            <p className="text-xs text-content-secondary mt-2.5 leading-relaxed">
              Free of cosmetic bloat. Fast keyboard-first interaction paths, intuitive screens, and zero unnecessary data fields during consults.
            </p>
          </div>
        </div>

        {/* Clinical Data Governance Card */}
        <div className="mt-14 max-w-5xl mx-auto">
          <div className="rounded-3xl bg-white border border-clinical-border p-8 sm:p-12 text-content-primary shadow-clinical relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-teal/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-soft border border-teal/20 text-teal-deep text-xs font-mono font-bold uppercase tracking-wider mb-4">
                <span className="w-2 h-2 rounded-full bg-teal animate-gentle-pulse" /> Clinical Data Governance
              </div>
              <h3 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-content-primary mb-3">
                Your practice data deserves careful handling
              </h3>
              <p className="text-sm sm:text-base text-content-secondary leading-relaxed mb-8">
                Veterinary medical records and client details are confidential. VetRx implements rigorous architectural isolation
                to ensure practice data sovereignty and security.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-4 rounded-xl bg-surface-canvas border border-clinical-border/80 hover:border-teal/30 hover:bg-teal-50/30 transition-all flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-teal-soft text-teal-deep flex items-center justify-center text-base shrink-0">🔒</span>
                  <span className="text-content-primary font-medium">Secure, encrypted account access</span>
                </div>
                <div className="p-4 rounded-xl bg-surface-canvas border border-clinical-border/80 hover:border-teal/30 hover:bg-teal-50/30 transition-all flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-teal-soft text-teal-deep flex items-center justify-center text-base shrink-0">🏛️</span>
                  <span className="text-content-primary font-medium">Practice-level strict data separation</span>
                </div>
                <div className="p-4 rounded-xl bg-surface-canvas border border-clinical-border/80 hover:border-teal/30 hover:bg-teal-50/30 transition-all flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-teal-soft text-teal-deep flex items-center justify-center text-base shrink-0">👥</span>
                  <span className="text-content-primary font-medium">Controlled practitioner permissions</span>
                </div>
                <div className="p-4 rounded-xl bg-surface-canvas border border-clinical-border/80 hover:border-teal/30 hover:bg-teal-50/30 transition-all flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-teal-soft text-teal-deep flex items-center justify-center text-base shrink-0">☁️</span>
                  <span className="text-content-primary font-medium">Reliable automated cloud architecture</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

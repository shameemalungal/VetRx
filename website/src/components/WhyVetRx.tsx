import React from 'react';

export const WhyVetRx: React.FC = () => {
  return (
    <section className="py-28 bg-gradient-to-b from-[#06252A] via-[#07333A] to-[#062025] text-white relative overflow-hidden scroll-reveal" data-purpose="why-vetrx" id="about">
      {/* Background tech glow effects */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-teal/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-96 h-96 bg-aqua/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-tech-grid opacity-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-400/20 text-aqua text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-aqua animate-pulse" />
            Authentic Clinical Heritage
          </div>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight mt-2">
            Built in India. Designed around real veterinary practice.
          </h2>
          <p className="text-base sm:text-lg text-teal-100/80 mt-4 leading-relaxed font-normal">
            VetRx is developed by veterinary doctors with 15+ years of clinical experience, with a simple objective:
            reduce the administrative burden around practice so veterinarians can focus more attention on clinical care.
          </p>
        </div>

        {/* 4 Confirmed Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-teal/50 hover:bg-white/[0.08] backdrop-blur-md transition-all duration-300 hover-lift-dark group">
            <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              🩺
            </div>
            <h3 className="font-heading font-bold text-base text-white group-hover:text-aqua transition-colors">
              Veterinarian-Led
            </h3>
            <p className="text-xs text-teal-100/70 mt-2.5 leading-relaxed">
              Designed by practicing clinicians who understand the pressure of outpatient volume, animal restraint, and rapid decision-making.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-sky-blue/50 hover:bg-white/[0.08] backdrop-blur-md transition-all duration-300 hover-lift-dark group">
            <div className="w-12 h-12 rounded-xl bg-sky-blue/20 border border-sky-blue/30 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              🐕
            </div>
            <h3 className="font-heading font-bold text-base text-white group-hover:text-sky-blue transition-colors">
              Veterinary-Specific
            </h3>
            <p className="text-xs text-teal-100/70 mt-2.5 leading-relaxed">
              Tailored specifically around multi-species dosage formulas, microchip identifiers, vaccination schedules, and veterinary formulary drugs.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-mint/50 hover:bg-white/[0.08] backdrop-blur-md transition-all duration-300 hover-lift-dark group">
            <div className="w-12 h-12 rounded-xl bg-mint/20 border border-mint/30 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              🌴
            </div>
            <h3 className="font-heading font-bold text-base text-white group-hover:text-mint transition-colors">
              Built in India (Kerala-Origin)
            </h3>
            <p className="text-xs text-teal-100/70 mt-2.5 leading-relaxed">
              Rooted in Kerala&apos;s clinical ecosystem, built around Indian veterinary medicine brands, pricing realities, and local clinic workflows.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-warm-accent/50 hover:bg-white/[0.08] backdrop-blur-md transition-all duration-300 hover-lift-dark group">
            <div className="w-12 h-12 rounded-xl bg-warm-accent/20 border border-warm-accent/30 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              ⚙️
            </div>
            <h3 className="font-heading font-bold text-base text-white group-hover:text-warm-accent transition-colors">
              Designed Around Real Practice
            </h3>
            <p className="text-xs text-teal-100/70 mt-2.5 leading-relaxed">
              Free of cosmetic bloat. Fast keyboard-first interaction paths, intuitive screens, and zero unnecessary data fields during consults.
            </p>
          </div>
        </div>

        {/* Clinical Data Governance Card */}
        <div className="mt-14 max-w-5xl mx-auto">
          <div className="rounded-3xl bg-gradient-to-br from-[#0B3D44] via-[#09353B] to-[#052125] border border-teal/40 p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-teal/15 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/40 text-aqua text-xs font-mono font-bold uppercase tracking-wider mb-4">
                <span className="w-2 h-2 rounded-full bg-aqua animate-gentle-pulse"></span> Clinical Data Governance
              </div>
              <h3 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-white mb-3">
                Your practice data deserves careful handling
              </h3>
              <p className="text-sm sm:text-base text-teal-100/80 leading-relaxed mb-8">
                Veterinary medical records and client details are confidential. VetRx implements rigorous architectural isolation
                to ensure practice data sovereignty and security.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-4 rounded-xl bg-white/[0.06] border border-white/10 hover:border-teal/30 hover:bg-white/[0.09] transition-all flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-teal-500/20 text-aqua flex items-center justify-center text-base shrink-0">🔒</span>
                  <span className="text-teal-50">Secure, encrypted account access</span>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.06] border border-white/10 hover:border-teal/30 hover:bg-white/[0.09] transition-all flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-teal-500/20 text-aqua flex items-center justify-center text-base shrink-0">🏛️</span>
                  <span className="text-teal-50">Practice-level strict data separation</span>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.06] border border-white/10 hover:border-teal/30 hover:bg-white/[0.09] transition-all flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-teal-500/20 text-aqua flex items-center justify-center text-base shrink-0">👥</span>
                  <span className="text-teal-50">Controlled practitioner permissions</span>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.06] border border-white/10 hover:border-teal/30 hover:bg-white/[0.09] transition-all flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-teal-500/20 text-aqua flex items-center justify-center text-base shrink-0">☁️</span>
                  <span className="text-teal-50">Reliable automated cloud architecture</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

import React from 'react';
import { APP_REGISTER_URL } from './Navbar';

export const FinalCta: React.FC = () => {
  return (
    <section className="py-24 bg-gradient-to-b from-white to-[#F6FAFA] relative overflow-hidden scroll-reveal" data-purpose="final-cta">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="rounded-3xl bg-gradient-to-br from-[#062F35] via-[#07474C] to-[#041D21] p-10 sm:p-20 text-white text-center shadow-hero-glow relative overflow-hidden border border-teal-500/30">
          {/* Subtle tech background and glow effects */}
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-teal/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-aqua/20 blur-3xl pointer-events-none" />
          <div className="absolute inset-0 bg-tech-grid opacity-10 pointer-events-none" />

          {/* ECG pulse line art motif */}
          <div className="absolute inset-x-0 bottom-6 flex justify-center opacity-15 pointer-events-none">
            <svg className="w-full max-w-xl h-10 text-aqua" fill="none" viewBox="0 0 600 40">
              <path d="M0,20 L200,20 L220,5 L235,35 L250,10 L265,28 L275,20 L600,20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <div className="relative z-10 max-w-2xl mx-auto space-y-7">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-aqua text-xs font-mono font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-aqua animate-gentle-pulse" />
              Start Today • 14 Days Free Trial
            </div>
            
            <h2 className="font-heading font-extrabold text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-tight">
              Ready to simplify your practice?
            </h2>
            
            <p className="text-base sm:text-lg text-teal-100/90 leading-relaxed font-normal max-w-xl mx-auto">
              Start your 14-day free trial and see how VetRx fits into your veterinary consultation and dispensing workflow.
            </p>
            
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={APP_REGISTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-9 py-4 rounded-xl bg-white text-teal-dark hover:bg-teal-50 font-heading font-extrabold text-sm sm:text-base shadow-xl hover:shadow-2xl transition-all duration-200 hover:-translate-y-0.5 active:scale-95 group flex items-center justify-center gap-2"
              >
                <span>Start 14-Day Free Trial</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </a>
              <a
                href="#contact"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-heading font-bold text-sm sm:text-base border border-white/20 transition-all duration-200 backdrop-blur-md"
              >
                Book a Practice Demo
              </a>
            </div>
            
            <p className="text-xs text-teal-100/70 pt-2 font-mono">
              Instant setup • Unlimited patients during trial • Dedicated onboarding assistance
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

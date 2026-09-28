import React from 'react';

export const AboutTrust: React.FC = () => {
  return (
    <section className="py-24 bg-gradient-to-b from-white via-[#F6FAFA] to-white relative overflow-hidden scroll-reveal" data-purpose="about-section">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200/60 text-teal-800 text-xs font-mono font-bold uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-teal animate-gentle-pulse" />
          Our Story
        </div>
        <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-content-primary tracking-tight">
          Built in India. Designed around real veterinary practice.
        </h2>
        <p className="text-base sm:text-lg text-content-secondary leading-relaxed max-w-2xl mx-auto">
          VetRx is developed by veterinary doctors with 15+ years of clinical experience.
          Engineered to solve the day-to-day documentation and practice challenges of active clinical consultations,
          VetRx delivers modern, reliable software so practitioners can focus on better treatment.
        </p>
        <div className="pt-3">
          <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold text-teal-900 bg-gradient-to-r from-teal-50 via-teal-soft/80 to-mint/40 px-4 py-2 rounded-full border border-teal-200/80 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-teal" />
            Kerala, India • Serving Veterinarians Nationally
          </span>
        </div>
      </div>
    </section>
  );
};

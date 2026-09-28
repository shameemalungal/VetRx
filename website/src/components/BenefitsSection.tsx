import React from 'react';
import { APP_REGISTER_URL } from './Navbar';

export const BenefitsSection: React.FC = () => {
  const benefits = [
    { title: 'Faster Rx Creation', desc: 'Create verified prescriptions in under 45 seconds.', iconBg: 'from-teal/20 to-aqua/20 text-teal-dark', highlight: 'Speed' },
    { title: 'Organized Records', desc: 'Every visit, symptom, and diagnosis logged chronologically.', iconBg: 'from-sky-blue/20 to-blue/20 text-sky-blue', highlight: 'Clarity' },
    { title: 'Easy History Access', desc: 'Check what was prescribed 6 months ago in 2 clicks.', iconBg: 'from-violet/20 to-purple-500/20 text-violet', highlight: 'Instant' },
    { title: 'Owner Info in One Place', desc: 'Consolidate multiple pets under one responsible client phone.', iconBg: 'from-mint/30 to-teal/20 text-teal-dark', highlight: 'Unified' },
    { title: 'Print-Ready Rx', desc: 'Clean clinical letterhead formatted for any standard printer.', iconBg: 'from-teal/20 to-aqua/20 text-teal-dark', highlight: 'Letterhead' },
    { title: 'Invoices & Receipts', desc: 'Clear fee documentation in INR that builds trust with clients.', iconBg: 'from-amber-400/20 to-warm-accent/20 text-warm-accent', highlight: 'INR Billing' },
    { title: 'Zero Repetitive Paperwork', desc: 'Save frequently used medication bundles and care instructions.', iconBg: 'from-sky-blue/20 to-blue/20 text-sky-blue', highlight: 'Efficiency' },
    { title: 'Better Organization', desc: 'Consistent professional structure across all clinical team members.', iconBg: 'from-violet/20 to-purple-500/20 text-violet', highlight: 'Workflow' },
  ];

  return (
    <section className="py-28 bg-gradient-to-b from-[#F6FAFA] via-white to-[#F0F7F7] relative overflow-hidden scroll-reveal" data-purpose="benefits-section">
      {/* Decorative ambient elements */}
      <div className="absolute top-1/4 -right-40 w-96 h-96 bg-aqua/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 -left-40 w-96 h-96 bg-teal/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200/60 text-teal-800 text-xs font-mono font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-teal animate-gentle-pulse" />
              Real Practice Impact
            </div>
            <h2 className="font-heading font-extrabold text-3xl sm:text-5xl text-content-primary leading-tight tracking-tight">
              Less administration. <br />
              <span className="bg-gradient-to-r from-teal via-aqua to-sky-blue bg-clip-text text-transparent">
                More attention
              </span>{' '}
              to your patients.
            </h2>
            <p className="text-base sm:text-lg text-content-secondary leading-relaxed">
              Clinical work shouldn&apos;t mean endless transcription, lost paper cards, or manual dosage calculations.
              VetRx restores your focus to diagnostics, surgery, and compassionate treatment.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <a
                href={APP_REGISTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-teal via-[#0EA598] to-aqua rounded-xl shadow-clinical hover:shadow-hero-glow hover:-translate-y-0.5 transition-all duration-200 group"
              >
                <span>Try VetRx Risk-Free</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </a>
              <span className="text-xs text-content-tertiary font-mono">14-Day Free Trial • No lock-in</span>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4.5">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="p-5 rounded-2xl bg-white/90 backdrop-blur-sm border border-clinical-border/80 shadow-subtle hover:shadow-card-lift hover:border-teal/40 transition-all duration-300 flex items-start gap-3.5 group hover:-translate-y-1"
              >
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${b.iconBg} flex items-center justify-center text-sm font-bold shrink-0 border border-current/10 shadow-xs group-hover:scale-110 transition-transform`}>
                  ✓
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-heading font-bold text-sm text-content-primary group-hover:text-teal transition-colors">
                      {b.title}
                    </h3>
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100/80 text-content-tertiary shrink-0">
                      {b.highlight}
                    </span>
                  </div>
                  <p className="text-xs text-content-secondary mt-1 leading-relaxed">
                    {b.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

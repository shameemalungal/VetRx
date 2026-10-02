import React from 'react';

export const ProductOverview: React.FC = () => {
  const pillars = [
    {
      num: '1',
      title: 'Prescribe Faster',
      desc: 'Create professional veterinary prescriptions without repetitive paperwork. Calibrated for species weight and specific drug forms.',
      accentColor: 'border-teal/30 hover:border-teal',
      iconBg: 'bg-teal-soft text-teal-deep',
      gradientTag: 'gradient-teal-aqua',
      badge: 'Speed & Precision',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      ),
    },
    {
      num: '2',
      title: 'Know Your Patients',
      desc: 'Keep animal, owner and clinical history organized and easy to access. Instant cross-lookup via name, phone number, or microchip ID.',
      accentColor: 'border-sky-blue/30 hover:border-sky-blue',
      iconBg: 'bg-sky-soft text-sky-blue',
      gradientTag: 'bg-gradient-to-r from-sky-blue to-electric-blue',
      badge: 'Instant Records',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      ),
    },
    {
      num: '3',
      title: 'Manage Your Practice',
      desc: 'Handle treatment records, invoices and receipts from the same platform. Built-in Indian Rupee (₹ INR) clinical billing with zero clutter.',
      accentColor: 'border-violet/30 hover:border-violet',
      iconBg: 'bg-violet-soft text-violet',
      gradientTag: 'gradient-blue-violet',
      badge: 'Billing & Ledgers',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      ),
    },
    {
      num: '4',
      title: 'Stay Focused On Care',
      desc: 'Spend less time managing practice details and more time focusing on your patients. Clean screen flows designed for fast consultation rooms.',
      accentColor: 'border-mint/50 hover:border-aqua',
      iconBg: 'bg-mint-soft text-teal-deep',
      gradientTag: 'gradient-mint-aqua',
      badge: 'Patient First',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      ),
    },
  ];

  return (
    <section className="py-24 bg-white border-y border-clinical-border scroll-reveal relative" data-purpose="product-overview" id="product">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-soft text-teal-deep text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <span>Engineered for Everyday Clinics</span>
          </div>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-content-primary tracking-tight">
            Everything your veterinary practice needs.{' '}
            <span className="gradient-text-teal">Nothing it doesn&apos;t.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map((p) => (
            <div
              key={p.num}
              className={`p-7 rounded-3xl bg-surface-canvas border ${p.accentColor} hover-lift-card flex flex-col justify-between transition-all group`}
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className={`w-14 h-14 rounded-2xl ${p.iconBg} flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-transform`}>
                    {p.icon}
                  </div>
                  <span className="text-xs font-mono font-bold text-content-muted">
                    0{p.num}
                  </span>
                </div>
                <h3 className="font-heading font-extrabold text-xl text-content-primary mb-3">
                  {p.num}. {p.title}
                </h3>
                <p className="text-sm text-content-secondary leading-relaxed">
                  {p.desc}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-clinical-border/60 flex items-center justify-between">
                <span className="text-[11px] font-mono font-semibold text-content-muted">
                  {p.badge}
                </span>
                <span className="w-2 h-2 rounded-full bg-teal/40 group-hover:bg-teal transition-colors"></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};


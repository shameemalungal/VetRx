import React, { useState } from 'react';
import { APP_REGISTER_URL } from './Navbar';

export const PricingSection: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  return (
    <section className="py-28 bg-gradient-to-b from-[#F0F7F7] via-white to-[#F6FAFA] relative overflow-hidden scroll-reveal" data-purpose="pricing-section" id="pricing">
      {/* Decorative ambient elements */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-teal/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200/60 text-teal-800 text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-teal animate-gentle-pulse" />
            Predictable Plans
          </div>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-content-primary mt-2 tracking-tight">
            Simple, transparent pricing.
          </h2>
          <p className="text-base sm:text-lg text-content-secondary mt-3 max-w-2xl mx-auto leading-relaxed">
            No per-patient or per-prescription charges. Choose the tier that matches your practice structure.
          </p>

          {/* Interactive Monthly vs Annual Toggle */}
          <div className="mt-8 inline-flex items-center p-1.5 rounded-2xl bg-slate-100/90 border border-slate-200/80 shadow-inner backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2.5 rounded-xl text-xs font-heading font-bold transition-all duration-200 ${
                billingCycle === 'monthly'
                  ? 'text-teal-dark bg-white shadow-md shadow-slate-200'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-6 py-2.5 rounded-xl text-xs font-heading font-bold transition-all duration-200 flex items-center gap-2 ${
                billingCycle === 'annual'
                  ? 'text-teal-dark bg-white shadow-md shadow-slate-200'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              <span>Annual Billing</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
          {/* Plan 1: Individual */}
          <div className="p-8 sm:p-9 rounded-3xl bg-white/90 backdrop-blur-sm border border-slate-200/90 flex flex-col justify-between shadow-subtle hover:shadow-card-lift hover:border-teal/30 transition-all duration-300 hover:-translate-y-1">
            <div>
              <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-teal-50 text-[11px] font-mono font-bold text-teal uppercase tracking-wider mb-2">
                Solo Practice
              </div>
              <h3 className="font-heading font-extrabold text-2xl text-content-primary">INDIVIDUAL</h3>
              <p className="text-xs text-content-secondary mt-1.5 leading-relaxed">
                Ideal for solo private practitioners and mobile field vets.
              </p>
              
              <div className="my-7 p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-heading font-black text-4xl sm:text-5xl text-content-primary tracking-tight">
                    {billingCycle === 'monthly' ? '₹599' : '₹5,999'}
                  </span>
                  <span className="text-xs font-mono text-content-secondary font-medium">
                    {billingCycle === 'monthly' ? '/ month' : '/ year'}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-teal-dark font-semibold mt-1.5 min-h-[18px]">
                  {billingCycle === 'monthly' ? 'Billed monthly' : 'Billed annually'}
                </p>
              </div>

              <ul className="space-y-3.5 text-xs text-content-primary border-t border-slate-100 pt-6 mb-8">
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span><strong>Single veterinarian</strong> account</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span><strong>Unlimited</strong> patients &amp; owners</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span><strong>Unlimited</strong> prescriptions &amp; history</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span>Itemized INR Invoices &amp; Receipts</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span>Standard treatment packages</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span>Unlimited clinical usage</span>
                </li>
              </ul>
            </div>
            <a
              href={APP_REGISTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 rounded-xl text-center text-xs font-heading font-bold bg-white text-content-primary hover:bg-slate-50 border border-slate-200 transition-all shadow-xs hover:border-slate-300"
            >
              Start 14-Day Free Trial
            </a>
          </div>

          {/* Plan 2: Clinic (Elevated / Most Popular) */}
          <div className="p-8 sm:p-9 rounded-3xl bg-white border-2 border-teal shadow-plan-highlight flex flex-col justify-between relative transform lg:-translate-y-3 transition-all duration-300 hover:-translate-y-4">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-teal via-teal-dark to-teal text-white text-[11px] font-mono uppercase font-bold tracking-wider shadow-md">
              Most Popular For Clinics
            </div>
            <div>
              <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-teal-50 text-[11px] font-mono font-bold text-teal uppercase tracking-wider mb-2">
                Complete Team
              </div>
              <h3 className="font-heading font-extrabold text-2xl text-content-primary">CLINIC</h3>
              <p className="text-xs text-content-secondary mt-1.5 leading-relaxed">
                For multi-doctor clinics with receptionist &amp; accounting staff.
              </p>

              <div className="my-7 p-4 rounded-2xl bg-gradient-to-br from-teal-50/70 to-aqua/10 border border-teal-200/50">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-heading font-black text-4xl sm:text-5xl text-teal-dark tracking-tight">
                    {billingCycle === 'monthly' ? '₹1,499' : '₹14,999'}
                  </span>
                  <span className="text-xs font-mono text-content-secondary font-medium">
                    {billingCycle === 'monthly' ? '/ month' : '/ year'}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-teal-800 font-bold mt-1.5 min-h-[18px]">
                  {billingCycle === 'monthly' ? 'Billed monthly' : 'Billed annually'}
                </p>
              </div>

              <ul className="space-y-3.5 text-xs text-content-primary border-t border-teal-100 pt-6 mb-8">
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal text-white flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span><strong>Up to 5 veterinarians</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal text-white flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span><strong>Receptionist</strong> access</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal text-white flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span><strong>Accountant</strong> access</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal text-white flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span>Shared clinic records &amp; patient history</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal text-white flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span>Treatment packages library &amp; multi-doctor approvals</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal text-white flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span>Unlimited clinical usage</span>
                </li>
              </ul>
            </div>
            <a
              href={APP_REGISTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 px-4 rounded-xl text-center text-sm font-heading font-extrabold bg-gradient-to-r from-teal via-teal-dark to-teal hover:opacity-95 text-white shadow-clinical transition-all hover:shadow-hero-glow"
            >
              Start 14-Day Free Trial
            </a>
          </div>

          {/* Plan 3: Enterprise */}
          <div className="p-8 sm:p-9 rounded-3xl bg-white/90 backdrop-blur-sm border border-slate-200/90 flex flex-col justify-between shadow-subtle hover:shadow-card-lift hover:border-teal/30 transition-all duration-300 hover:-translate-y-1">
            <div>
              <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-teal-50 text-[11px] font-mono font-bold text-teal uppercase tracking-wider mb-2">
                High Volume
              </div>
              <h3 className="font-heading font-extrabold text-2xl text-content-primary">ENTERPRISE</h3>
              <p className="text-xs text-content-secondary mt-1.5 leading-relaxed">
                For larger veterinary hospitals, chains &amp; clinical organizations.
              </p>

              <div className="my-7 p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-heading font-black text-4xl sm:text-5xl text-content-primary tracking-tight">Custom</span>
                </div>
                <p className="text-[11px] font-mono text-content-secondary mt-1.5 min-h-[18px]">Tailored volume agreements</p>
              </div>

              <ul className="space-y-3.5 text-xs text-content-primary border-t border-slate-100 pt-6 mb-8">
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span>Unlimited veterinarians &amp; staff roles</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span>Multi-location practice switching</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span>Custom practice configurations &amp; onboarding</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span>Dedicated onboarding assistance</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span>Unlimited clinical usage</span>
                </li>
              </ul>
            </div>
            <a
              href="#contact"
              className="w-full py-3.5 px-4 rounded-xl text-center text-xs font-heading font-bold bg-white text-content-primary hover:bg-slate-50 border border-slate-200 transition-all shadow-xs hover:border-slate-300"
            >
              Contact Sales
            </a>
          </div>
        </div>

        {/* Transparent Trial Disclosure Note */}
        <div className="max-w-2xl mx-auto text-center mt-12 p-4.5 rounded-2xl bg-teal-50/80 border border-teal-200/60 text-xs text-content-secondary shadow-xs">
          <p>
            <strong className="text-content-primary font-heading font-bold">Trial Details:</strong> 14 days free. Your selected plan begins after the trial
            unless you cancel beforehand.
          </p>
        </div>
      </div>
    </section>
  );
};

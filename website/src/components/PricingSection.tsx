import React, { useState } from 'react';

const APP_REGISTER_BASE = 'https://app.vetrx.brightbase.in/register';

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
              aria-pressed={billingCycle === 'monthly'}
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
              aria-pressed={billingCycle === 'annual'}
            >
              <span>Annual Billing</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid — Consistent hover & focus elevation across all 3 cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
          {/* Plan 1: Individual */}
          <div
            tabIndex={0}
            className="group p-8 sm:p-9 rounded-3xl bg-white border border-slate-200/90 flex flex-col justify-between shadow-subtle hover:shadow-card-lift hover:border-teal/50 hover:-translate-y-1.5 focus-within:shadow-card-lift focus-within:border-teal/50 focus-within:-translate-y-1.5 focus:outline-none transition-all duration-300"
          >
            <div>
              <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-teal-50 text-[11px] font-mono font-bold text-teal uppercase tracking-wider mb-2">
                Solo Practice
              </div>
              <h3 className="font-heading font-extrabold text-2xl text-content-primary group-hover:text-teal-dark transition-colors">INDIVIDUAL</h3>
              <p className="text-xs text-content-secondary mt-1.5 leading-relaxed">
                Ideal for solo private practitioners and mobile field vets.
              </p>
              
              <div className="my-7 p-4 rounded-2xl bg-slate-50/80 border border-slate-100 group-hover:bg-teal-50/40 group-hover:border-teal-100 transition-colors">
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
                  <span><strong>1 veterinarian</strong> account</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span><strong>Unlimited</strong> usage</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span><strong>Unlimited</strong> patients &amp; owners</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span><strong>Unlimited</strong> prescriptions &amp; clinical history</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span>Itemized INR Invoices &amp; Receipts</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span>Standard treatment packages</span>
                </li>
              </ul>
            </div>
            <a
              href={`${APP_REGISTER_BASE}?plan=INDIVIDUAL&interval=${billingCycle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 rounded-xl text-center text-xs font-heading font-bold bg-white text-content-primary hover:bg-teal-50 hover:text-teal-dark border border-slate-200 hover:border-teal/40 transition-all shadow-xs"
            >
              Start 14-Day Free Trial
            </a>
          </div>

          {/* Plan 2: Clinic */}
          <div
            tabIndex={0}
            className="group p-8 sm:p-9 rounded-3xl bg-white border border-slate-200/90 flex flex-col justify-between shadow-subtle hover:shadow-card-lift hover:border-teal/50 hover:-translate-y-1.5 focus-within:shadow-card-lift focus-within:border-teal/50 focus-within:-translate-y-1.5 focus:outline-none transition-all duration-300"
          >
            <div>
              <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-teal-50 text-[11px] font-mono font-bold text-teal uppercase tracking-wider mb-2">
                Complete Team
              </div>
              <h3 className="font-heading font-extrabold text-2xl text-content-primary group-hover:text-teal-dark transition-colors">CLINIC</h3>
              <p className="text-xs text-content-secondary mt-1.5 leading-relaxed">
                For multi-doctor clinics with receptionist &amp; accounting staff.
              </p>

              <div className="my-7 p-4 rounded-2xl bg-slate-50/80 border border-slate-100 group-hover:bg-teal-50/40 group-hover:border-teal-100 transition-colors">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-heading font-black text-4xl sm:text-5xl text-content-primary tracking-tight">
                    {billingCycle === 'monthly' ? '₹1,499' : '₹14,999'}
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
                  <span><strong>Up to 5 veterinarians</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span><strong>Receptionist access</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span><strong>Accountant access</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span><strong>Unlimited</strong> usage</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span>Shared clinic records &amp; patient history</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-teal-soft text-teal-dark flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span>Treatment packages library &amp; multi-doctor approvals</span>
                </li>
              </ul>
            </div>
            <a
              href={`${APP_REGISTER_BASE}?plan=CLINIC&interval=${billingCycle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 rounded-xl text-center text-xs font-heading font-bold bg-white text-content-primary hover:bg-teal-50 hover:text-teal-dark border border-slate-200 hover:border-teal/40 transition-all shadow-xs"
            >
              Start 14-Day Free Trial
            </a>
          </div>

          {/* Plan 3: Enterprise */}
          <div
            tabIndex={0}
            className="group p-8 sm:p-9 rounded-3xl bg-white border border-slate-200/90 flex flex-col justify-between shadow-subtle hover:shadow-card-lift hover:border-teal/50 hover:-translate-y-1.5 focus-within:shadow-card-lift focus-within:border-teal/50 focus-within:-translate-y-1.5 focus:outline-none transition-all duration-300"
          >
            <div>
              <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-teal-50 text-[11px] font-mono font-bold text-teal uppercase tracking-wider mb-2">
                High Volume
              </div>
              <h3 className="font-heading font-extrabold text-2xl text-content-primary group-hover:text-teal-dark transition-colors">ENTERPRISE</h3>
              <p className="text-xs text-content-secondary mt-1.5 leading-relaxed">
                For larger veterinary hospitals, chains &amp; clinical organizations.
              </p>

              <div className="my-7 p-4 rounded-2xl bg-slate-50/80 border border-slate-100 group-hover:bg-teal-50/40 group-hover:border-teal-100 transition-colors">
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

        {/* Transparent Trial Disclosure & PayU Authorization Information */}
        <div className="max-w-3xl mx-auto text-center mt-12 p-5 rounded-2xl bg-teal-50/80 border border-teal-200/60 text-xs text-content-secondary shadow-xs space-y-2">
          <p className="font-heading font-bold text-content-primary text-sm">
            14 days free. Your selected plan begins after the trial unless you cancel beforehand.
          </p>
          <p className="leading-relaxed">
            Your selected payment method will be authorized during signup for recurring billing. No subscription fee is charged during the 14-day trial. Any authorization/verification amount displayed by the payment provider is handled according to the payment provider&apos;s trial authorization process.
          </p>
          <p className="text-[11px] text-content-muted leading-relaxed">
            For PayU free-trial Hosted Checkout recurring registration: Cards (₹2 authorization transaction), UPI (₹2 authorization transaction), Net Banking (₹0 authorization transaction). This is an authorization verification transaction and is not your VetRx subscription fee. Applicable taxes, if any, will be reflected in the applicable invoice.
          </p>
        </div>
      </div>
    </section>
  );
};

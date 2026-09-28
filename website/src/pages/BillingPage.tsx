import React from 'react';
import { LegalLayout } from '../components/LegalLayout';
import { Link } from 'react-router-dom';

export const BillingPage: React.FC = () => {
  const toc = [
    { id: 'overview', title: '1. Transparent SaaS Pricing' },
    { id: 'plans', title: '2. Available Subscription Plans' },
    { id: 'trial-terms', title: '3. 14-Day Free Trial Mechanics' },
    { id: 'billing-cycles', title: '4. Monthly vs Annual Cycles' },
    { id: 'payment-methods', title: '5. Supported Payment Methods' },
    { id: 'invoices-and-taxes', title: '6. GST Tax Invoices & Compliance' },
    { id: 'plan-changes', title: '7. Upgrades & Downgrades' },
    { id: 'cancellation', title: '8. How to Cancel Your Plan' },
    { id: 'failed-transactions', title: '9. Failed Renewals & Grace Period' },
    { id: 'support', title: '10. Billing Support & Contact' },
  ];

  const relatedLinks = [
    {
      title: 'Refund & Cancellation Policy',
      href: '/refund-policy',
      desc: 'Specific legal conditions, refund criteria, and processing timelines.',
    },
    {
      title: 'Terms of Service',
      href: '/terms',
      desc: 'Master commercial agreement and service terms.',
    },
    {
      title: 'FAQ',
      href: '/faq',
      desc: 'Common questions on practice management, pricing, and multi-user setups.',
    },
  ];

  return (
    <LegalLayout
      title="Subscription & Billing Guide"
      subtitle="Complete, transparent guide to VetRx subscription tiers, 14-day trial progression, renewal cycles, GST invoices, and account management."
      badge="Commercial Guide"
      lastUpdated="September 24, 2026"
      toc={toc}
      relatedLinks={relatedLinks}
    >
      <div className="space-y-12">
        {/* Notice */}
        <div className="p-4 rounded-xl bg-surface-card border border-clinical-border text-sm text-content-secondary space-y-1">
          <p className="font-semibold text-content-primary">Informational Notice</p>
          <p>
            This page provides commercial information about VetRx software subscriptions. VetRx does not process payments or capture financial details on this marketing website. Active subscription management occurs securely within the authenticated VetRx application console.
          </p>
        </div>

        {/* Section 1 */}
        <section id="overview" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            1. Transparent SaaS Pricing
          </h2>
          <p className="text-content-secondary leading-relaxed">
            VetRx is designed to bring modern, accessible practice management technology to Indian veterinary practitioners without unpredictable hidden fees, mandatory hardware lock-in, or long-term punitive contracts.
          </p>
          <p className="text-content-secondary leading-relaxed">
            All plans include full feature access to patient records, examination logs, prescription generation, print formatting, client billing, and inventory tracking.
          </p>
        </section>

        {/* Section 2 */}
        <section id="plans" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            2. Available Subscription Plans
          </h2>
          <div className="grid md:grid-cols-2 gap-6 not-prose my-4">
            {/* Individual */}
            <div className="p-6 rounded-2xl border-2 border-clinical-border bg-white shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-dark bg-teal-soft px-2.5 py-1 rounded-full">
                    Individual
                  </span>
                  <span className="text-xs text-content-muted">Solo &amp; Mobile Vets</span>
                </div>
                <h3 className="font-heading font-extrabold text-2xl text-content-primary">
                  ₹599 <span className="text-sm font-normal text-content-secondary">/ month</span>
                </h3>
                <p className="text-sm text-teal-dark font-medium mt-1">
                  Or ₹5,999 / year
                </p>
                <hr className="my-4 border-clinical-border" />
                <ul className="space-y-2.5 text-sm text-content-secondary">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal"></span>
                    1 Registered Veterinary Practitioner
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal"></span>
                    Unlimited Patients &amp; Consultations
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal"></span>
                    Prescriptions with Clinic Letterhead
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal"></span>
                    Patient Clinical History &amp; Vaccines
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal"></span>
                    Client Invoices &amp; PDF Receipts
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-clinical-border">
                <a
                  href="https://app.vetrx.brightbase.in/register"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center w-full py-2.5 px-4 rounded-xl bg-teal-soft text-teal-dark font-heading font-semibold text-sm hover:bg-teal hover:text-white transition-colors"
                >
                  Start 14-Day Free Trial
                </a>
              </div>
            </div>

            {/* Clinic */}
            <div className="p-6 rounded-2xl border-2 border-teal bg-white shadow-md flex flex-col justify-between relative">
              <div className="absolute -top-3 right-6 bg-teal text-white text-[11px] font-mono font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-sm">
                Most Popular
              </div>
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-dark bg-teal-soft px-2.5 py-1 rounded-full">
                    Clinic
                  </span>
                  <span className="text-xs text-content-muted">Hospitals &amp; Clinics</span>
                </div>
                <h3 className="font-heading font-extrabold text-2xl text-content-primary">
                  ₹1,499 <span className="text-sm font-normal text-content-secondary">/ month</span>
                </h3>
                <p className="text-sm text-teal-dark font-medium mt-1">
                  Or ₹14,999 / year
                </p>
                <hr className="my-4 border-clinical-border" />
                <ul className="space-y-2.5 text-sm text-content-secondary">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal"></span>
                    Up to 5 Licensed Veterinarians
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal"></span>
                    Dedicated Receptionist Desk Role
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal"></span>
                    Dedicated Clinic Accountant Role
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal"></span>
                    Shared Clinic Inventory &amp; Stock Tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal"></span>
                    Practice Multi-Doctor Appointment Queue
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-clinical-border">
                <a
                  href="https://app.vetrx.brightbase.in/register"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center w-full py-2.5 px-4 rounded-xl bg-teal text-white font-heading font-semibold text-sm hover:bg-teal-dark transition-colors shadow-sm"
                >
                  Start 14-Day Free Trial
                </a>
              </div>
            </div>
          </div>

          {/* Enterprise Banner */}
          <div className="p-5 rounded-xl border border-clinical-border bg-surface-canvas space-y-2">
            <h3 className="font-heading font-bold text-base text-content-primary">
              Enterprise Practice &amp; Multi-Branch Hospital Networks
            </h3>
            <p className="text-sm text-content-secondary leading-relaxed">
              For veterinary college hospitals, multi-city clinic chains, or practices requiring more than 5 clinicians, we offer custom Enterprise arrangements with centralized administration and priority SLA support.{' '}
              <Link to="/contact" className="text-teal font-medium hover:underline">
                Contact Sales
              </Link>{' '}
              for customized pricing.
            </p>
          </div>
        </section>

        {/* Section 3 */}
        <section id="trial-terms" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            3. 14-Day Free Trial Mechanics
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Every new practice registration begins with a 14-day free trial.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li>You can explore every clinical tool, customize your prescription templates, and invite staff.</li>
            <li>Official Trial Policy: <em>&ldquo;14 days free. Your selected plan begins after the trial unless you cancel beforehand.&rdquo;</em></li>
            <li>If you decide not to continue, you can cancel before the trial period concludes.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section id="billing-cycles" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            4. Monthly vs Annual Billing Cycles
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Practices can choose between monthly and annual payment cycles:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li><strong>Monthly Billing:</strong> Billed every 30 days in advance. Offers maximum operational flexibility with zero long-term commitment.</li>
            <li><strong>Annual Billing:</strong> Billed once per year in advance. Simple, transparent pricing with no per-patient or per-prescription charges.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section id="payment-methods" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            5. Supported Payment Methods
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Subscription payments are processed securely through our authorized payment aggregator, PayU, supporting standard Indian domestic payment instruments:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary text-sm">
            <li>Unified Payments Interface (UPI / QR Code / VPA)</li>
            <li>Major Indian Debit and Credit Cards (Visa, Mastercard, RuPay)</li>
            <li>Net Banking across major banks in India</li>
            <li>Supported digital wallets</li>
          </ul>
        </section>

        {/* Section 6 */}
        <section id="invoices-and-taxes" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            6. GST Tax Invoices &amp; Compliance
          </h2>
          <p className="text-content-secondary leading-relaxed">
            VetRx generates electronic invoices for subscription payments.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li>If your practice holds an active Goods &amp; Services Tax Identification Number (GSTIN), you can input your GSTIN in <strong>Practice Settings</strong> to ensure input tax credit (ITC) details are recorded on your invoices.</li>
            <li>Tax invoices are available for download in PDF format directly from your practice administration console.</li>
            <li>Applicable taxes, if any, will be reflected in the applicable invoice.</li>
          </ul>
        </section>

        {/* Section 7 */}
        <section id="plan-changes" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            7. Upgrades &amp; Downgrades
          </h2>
          <p className="text-content-secondary leading-relaxed">
            As your clinic evolves, upgrading or downgrading your subscription tier is handled directly within your application settings. Users should review any applicable billing adjustments displayed in the application console at the time of making a plan change.
          </p>
        </section>

        {/* Section 8 */}
        <section id="cancellation" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            8. How to Cancel Your Plan
          </h2>
          <p className="text-content-secondary leading-relaxed">
            We make subscription cancellation straightforward:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-content-secondary text-sm">
            <li>Log in to your VetRx practice account as the Practice Owner or Admin.</li>
            <li>Navigate to <strong>Settings &rarr; Subscription &amp; Billing</strong>.</li>
            <li>Select <strong>Cancel Subscription</strong> and confirm your choice.</li>
          </ol>
          <p className="text-sm text-content-secondary leading-relaxed">
            You will retain uninterrupted access to your account and clinical records through the final day of your current paid billing period. No future renewal charges will occur.
          </p>
        </section>

        {/* Section 9 */}
        <section id="failed-transactions" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            9. Failed Renewals &amp; Grace Period
          </h2>
          <p className="text-content-secondary leading-relaxed">
            If an automatic renewal payment fails, we provide a 3-business-day grace period during which your practice continues to operate normally while you update your payment method. We send automated email alerts to prevent unintended disruption to your clinic.
          </p>
        </section>

        {/* Section 10 */}
        <section id="support" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            10. Billing Support &amp; Contact
          </h2>
          <p className="text-content-secondary leading-relaxed">
            For any billing questions, invoice corrections, or plan inquiries, please contact our team:
          </p>
          <div className="p-4 rounded-xl border border-clinical-border bg-white text-sm space-y-2">
            <p className="font-semibold text-content-primary">VetRx Accounts &amp; Billing Desk</p>
            <p className="text-content-secondary">
              Email:{' '}
              <a href="mailto:supportvetrx@gmail.com" className="text-teal font-medium hover:underline">
                supportvetrx@gmail.com
              </a>
            </p>
            <p className="text-content-secondary">
              WhatsApp Support:{' '}
              <a href="https://wa.me/919074683808" target="_blank" rel="noopener noreferrer" className="text-teal font-medium hover:underline">
                +91 90746 83808
              </a>
            </p>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
};

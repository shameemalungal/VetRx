import React from 'react';
import { LegalLayout } from '../components/LegalLayout';
import { Link } from 'react-router-dom';

export const ContactPage: React.FC = () => {
  const toc = [
    { id: 'channels', title: '1. Communication Channels' },
    { id: 'enquiry-types', title: '2. Dedicated Support Desks' },
    { id: 'business-details', title: '3. Business Details' },
    { id: 'existing-users', title: '4. Existing Practice Support' },
  ];

  const relatedLinks = [
    {
      title: 'Grievance & Support Desk',
      href: '/grievance',
      desc: 'Formal grievance escalation procedure and regulatory redressal.',
    },
    {
      title: 'Frequently Asked Questions',
      href: '/faq',
      desc: 'Instant answers to common questions regarding plans and features.',
    },
    {
      title: 'Subscription & Billing',
      href: '/billing',
      desc: 'Details on plan tiers, payment methods, and electronic tax invoices.',
    },
  ];

  return (
    <LegalLayout
      title="Contact &amp; Assistance"
      subtitle="Connect directly with the VetRx team for product demonstrations, technical onboarding, billing assistance, or privacy inquiries."
      badge="Customer Help"
      lastUpdated="September 24, 2026"
      toc={toc}
      relatedLinks={relatedLinks}
    >
      <div className="space-y-12">
        {/* Quick Action Banner */}
        <div className="grid sm:grid-cols-2 gap-4 not-prose">
          <div className="p-6 rounded-2xl border-2 border-clinical-border bg-white shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-mono font-bold uppercase text-teal-dark bg-teal-soft px-2.5 py-1 rounded-full">
                Primary Support Email
              </span>
              <h3 className="font-heading font-bold text-xl text-content-primary mt-2">
                Written Inquiries &amp; Help
              </h3>
              <p className="text-sm text-content-secondary mt-1">
                Reach our team directly for onboarding guidance, billing queries, and technical assistance.
              </p>
            </div>
            <a
              href="mailto:supportvetrx@gmail.com"
              className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal-soft text-teal-dark font-heading font-semibold text-sm hover:bg-teal hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              supportvetrx@gmail.com
            </a>
          </div>

          <div className="p-6 rounded-2xl border-2 border-teal bg-white shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-mono font-bold uppercase text-teal-dark bg-teal-soft px-2.5 py-1 rounded-full">
                Instant Messaging
              </span>
              <h3 className="font-heading font-bold text-xl text-content-primary mt-2">
                WhatsApp Quick Connect
              </h3>
              <p className="text-sm text-content-secondary mt-1">
                Chat with our practitioner support team for urgent consultation setup or quick product questions.
              </p>
            </div>
            <a
              href="https://wa.me/919074683808"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal text-white font-heading font-semibold text-sm hover:bg-teal-dark transition-colors shadow-sm"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
              </svg>
              Chat on WhatsApp: +91 90746 83808
            </a>
          </div>
        </div>

        {/* Section 1 */}
        <section id="channels" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            1. Communication Channels
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Whether you are exploring VetRx for your new veterinary clinic, setting up multi-doctor schedules, or seeking assistance with invoice templates, our team is available to assist you.
          </p>
        </section>

        {/* Section 2 */}
        <section id="enquiry-types" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            2. Dedicated Support Desks
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 not-prose my-4">
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-2">
              <h3 className="font-heading font-semibold text-content-primary text-sm">Product Demos &amp; Sales</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Guidance on choosing between Individual, Clinic, or custom Enterprise plans for veterinary hospital networks.
              </p>
              <p className="text-xs font-mono text-teal-dark font-medium">supportvetrx@gmail.com</p>
            </div>

            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-2">
              <h3 className="font-heading font-semibold text-content-primary text-sm">Technical Support &amp; Setup</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Assistance with staff role provisioning, drug inventory configuration, and prescription print formatting.
              </p>
              <p className="text-xs font-mono text-teal-dark font-medium">supportvetrx@gmail.com</p>
            </div>

            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-2">
              <h3 className="font-heading font-semibold text-content-primary text-sm">Billing &amp; Invoices</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Inquiries regarding subscription renewals, electronic tax invoices, credit adjustments, or plan upgrades.
              </p>
              <p className="text-xs font-mono text-teal-dark font-medium">supportvetrx@gmail.com</p>
            </div>

            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-2">
              <h3 className="font-heading font-semibold text-content-primary text-sm">Privacy &amp; Data Rights</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Data inquiries under India’s DPDP Act, 2023, consent updates, or data export requests.
              </p>
              <p className="text-xs font-mono text-teal-dark font-medium">
                See <Link to="/grievance" className="underline">Support &amp; Grievance Desk</Link>
              </p>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section id="business-details" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            3. Business Details
          </h2>
          <div className="p-5 rounded-2xl border border-clinical-border bg-surface-canvas space-y-3 not-prose">
            <h3 className="font-heading font-semibold text-content-primary text-sm">
              Business Identity &amp; Contact Information
            </h3>
            <div className="grid sm:grid-cols-2 gap-4 text-xs text-content-secondary">
              <div>
                <p className="font-mono text-content-muted uppercase">Business Identity</p>
                <p className="font-medium text-content-primary mt-1">
                  VetRx Support
                </p>
                <p className="text-content-muted mt-0.5">VetRx is operated by Alungal Shameem.</p>
              </div>
              <div>
                <p className="font-mono text-content-muted uppercase">Postal Address</p>
                <p className="font-medium text-content-primary mt-1">
                  Melattur PO, Malappuram District, Kerala, India
                </p>
              </div>
              <div>
                <p className="font-mono text-content-muted uppercase">Email Contact</p>
                <p className="font-medium text-content-primary mt-1">
                  supportvetrx@gmail.com
                </p>
              </div>
              <div>
                <p className="font-mono text-content-muted uppercase">WhatsApp Support</p>
                <p className="font-medium text-content-primary mt-1">
                  +91 90746 83808
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section id="existing-users" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            4. Existing Practice Support
          </h2>
          <p className="text-content-secondary leading-relaxed">
            If you already manage a practice on VetRx, you can sign in directly to access your clinical dashboard or manage subscription settings:
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <a
              href="https://app.vetrx.brightbase.in/login"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-teal text-white font-heading font-semibold text-sm hover:bg-teal-dark transition-colors shadow-sm"
            >
              Sign In to Practice &rarr;
            </a>
            <a
              href="https://app.vetrx.brightbase.in/register"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-surface-card border border-clinical-border text-content-primary font-heading font-semibold text-sm hover:bg-teal-soft hover:text-teal-dark transition-colors"
            >
              Start 14-Day Free Practice Trial
            </a>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
};
